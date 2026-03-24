import os

import torch
from transformers import (
    AutoConfig,
    AutoModelForCausalLM,
    AutoTokenizer,
    TextIteratorStreamer,
)


class QwenLLM:
    def __init__(
        self, model_path: str = "../../models/qwen3-0.6b", enable_thinking: bool = False
    ):
        if not os.path.exists(model_path):
            raise OSError(f"Model path not found: {model_path}")

        config = AutoConfig.from_pretrained(model_path)
        config.tie_word_embeddings = False

        self.tokenizer= AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            config=config,
            dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto",
        )
        self.enable_thinking = enable_thinking

    def generate_response(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
        stream: bool = False,
    ):
        system_prompt = "You are an expert in plant breeding, an AI assistant for the Institute of Plant Breeding. Use the provided information to answer accurately."

        # Prepend system message if not present
        if not messages or messages[0].get("role") != "system":
            messages = [{"role": "system", "content": system_prompt}] + messages

        text = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=self.enable_thinking,
        )

        inputs = self.tokenizer(text, return_tensors="pt").to(self.model.device)

        if stream:
            # For streaming, use TextIteratorStreamer to yield tokens
            streamer = TextIteratorStreamer(
                self.tokenizer, skip_prompt=True, skip_special_tokens=True
            )

            generation_kwargs = {
                **inputs,
                "max_new_tokens": max_tokens,
                "temperature": 0.7 if not self.enable_thinking else 0.6,
                "top_p": 0.8 if not self.enable_thinking else 0.95,
                "top_k": 20,
                "min_p": 0.0,
                "do_sample": True,
                "pad_token_id": self.tokenizer.eos_token_id,
                "streamer": streamer,
            }

            # Start generation in a thread since it's blocking
            import threading

            thread = threading.Thread(
                target=self.model.generate, kwargs=generation_kwargs
            )
            thread.start()

            # Yield tokens as they come
            for token in streamer:
                yield token

        else:
            # Non-streaming logic (existing code)
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    temperature=0.7 if not self.enable_thinking else 0.6,
                    top_p=0.8 if not self.enable_thinking else 0.95,
                    top_k=20,
                    min_p=0.0,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id,
                )

            # Decode and extract content (handle thinking if enabled)
            full_output = self.tokenizer.decode(
                outputs[0][len(inputs.input_ids[0]) :], skip_special_tokens=True
            )

            if isinstance(full_output, list):
                full_output = " ".join(full_output)

            if self.enable_thinking and "<think>" in full_output:
                # Split thinking and final answer
                parts = full_output.split("</think>")
                thinking = parts[0].replace("<think>", "").strip()
                answer = parts[1].strip() if len(parts) > 1 else ""
                return f"Thinking: {thinking}\n\nAnswer: {answer}"
            return full_output.strip()


if __name__ == "__main__":
    llm = QwenLLM(enable_thinking=False)
    messages = [{"role": "user", "content": "Hello, I'm Zach! Who are you?"}]
    response = llm.generate_response(messages)
    print(response)
