from transformers import AutoConfig, AutoModelForCausalLM, AutoTokenizer
import torch


class QwenLLM:
    def __init__(
        self, model_path: str = "../../models/qwen3-0.6b", enable_thinking: bool = False
    ):
        config = AutoConfig.from_pretrained(model_path)
        config.tie_word_embeddings = False

        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            config=config,
            dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto",
        )
        self.enable_thinking = enable_thinking

    def generate_response(self, query: str, max_tokens: int = 1024) -> str:
        system_prompt = "You are an expert in plant breeding, an AI assistant for the Institute of Plant Breeding. Use the provided information to answer accurately."
        user_prompt = f"Query: {query}\n\nAnswer concisely."

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        text = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
            enable_thinking=self.enable_thinking,
        )

        inputs = self.tokenizer(text, return_tensors="pt").to(self.model.device)

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


llm = QwenLLM(enable_thinking=False)
response = llm.generate_response("Hello, I'm Zach! Who are you?")
print(response)
