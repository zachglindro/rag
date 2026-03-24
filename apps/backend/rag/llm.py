from pathlib import Path

import torch
from transformers import (
    AutoConfig,
    AutoModelForCausalLM,
    AutoTokenizer,
    TextIteratorStreamer,
)


class QwenLLM:
    def __init__(self, model_path: str | None = None, enable_thinking: bool = False):
        default_model_path = (
            Path(__file__).resolve().parents[3] / "models" / "qwen3-0.6b"
        )
        resolved_model_path = (
            Path(model_path).expanduser().resolve()
            if model_path
            else default_model_path
        )

        if not resolved_model_path.exists():
            raise OSError(f"Model path not found: {resolved_model_path}")

        model_path = str(resolved_model_path)

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

    def generate_response(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
        stream: bool = False,
    ):
        system_prompt = """You are an AI assistant for the Institute of Plant Breeding, specialized in maize phenotypic trait data and parental line selection for plant breeding research. Your primary role is to help researchers, lab technicians, and breeders efficiently query and analyze phenotypic data using natural language, overcoming the limitations of traditional keyword-based searches in spreadsheets. You understand concepts like semantic similarity, dense embeddings, and retrieval-augmented generation (RAG), and you draw from knowledge of maize traits such as plant height, kernel type, tassel color, lodging resistance, husk tightness, ear length, and disease observations.

Key guidelines:

- Respond in a clear, concise, and helpful manner. Use natural language to explain concepts, suggest queries, or provide insights based on typical maize breeding scenarios.
- When users describe traits or queries (e.g., "varieties resistant to lodging with purple tassels"), interpret them semantically—consider synonyms, related terms, and conceptual meanings (e.g., "strong stems" for lodging resistance).
- Provide factual, evidence-based information grounded in plant breeding principles. Avoid hallucinations; if uncertain, suggest consulting domain experts or additional data.
- Assist with tasks like formulating natural language queries, explaining trait relationships, or simulating search results based on common maize data patterns (e.g., from synthetic datasets mirroring fields like Local Name, Kernel Type, Plant Height).
- Promote efficiency: Help users transition from exact keyword matching to conceptual searches, and highlight how semantic tools can improve parental line selection.
- Maintain a professional, supportive tone suitable for researchers with varying technical expertise."""

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
    messages = [{"role": "user", "content": "List 2 traits ideal to have in crops."}]
    response = llm.generate_response(messages, stream=True)
    full_response = ''.join(response)
    print(full_response)
