from pathlib import Path
import inspect
import os

import torch
from groq import Groq
from typing import Any
from transformers import (
    AutoModelForCausalLM,
    AutoProcessor,
    TextIteratorStreamer,
)


class GemmaLLM:
    def __init__(self, model_path: str | None = None, enable_thinking: bool = False):
        default_model_path = (
            Path(__file__).resolve().parents[3] / "models" / "gemma-4-E2B-it"
        )
        resolved_model_path = (
            Path(model_path).expanduser().resolve()
            if model_path
            else default_model_path
        )

        if not resolved_model_path.exists():
            raise OSError(f"Model path not found: {resolved_model_path}")

        model_path = str(resolved_model_path)

        self.processor = AutoProcessor.from_pretrained(model_path)
        # AutoProcessor wraps the tokenizer needed for text streaming.
        self.tokenizer = getattr(self.processor, "tokenizer", self.processor)
        self.model: Any = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype="auto",
            device_map="auto",
        )
        self.enable_thinking = enable_thinking

    def cleanup(self):
        """Clean up model resources and free GPU memory."""
        if hasattr(self, "model") and self.model is not None:
            del self.model
        if hasattr(self, "processor") and self.processor is not None:
            del self.processor
        if hasattr(self, "tokenizer") and self.tokenizer is not None:
            del self.tokenizer
        # Force garbage collection and CUDA cache clearing
        import gc

        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def _filter_supported_model_inputs(self, inputs: dict[str, Any]) -> dict[str, Any]:
        """Drop processor keys unsupported by the loaded model's forward signature."""
        try:
            forward_params = set(inspect.signature(self.model.forward).parameters)
        except (TypeError, ValueError):
            return inputs

        return {key: value for key, value in inputs.items() if key in forward_params}

    def generate_response(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
        stream: bool = False,
    ):
        system_prompt = """You are an AI assistant for the Institute of Plant Breeding, specialized in maize phenotypic trait data and parental line selection for plant breeding research. Your primary role is to help researchers, lab technicians, and breeders efficiently query and analyze phenotypic data using natural language, overcoming the limitations of traditional keyword-based searches in spreadsheets. You understand concepts like semantic similarity, dense embeddings, and retrieval-augmented generation (RAG), and you draw from knowledge of maize traits.

Key guidelines:

- Respond in a clear, concise, and helpful manner. Use natural language to explain concepts, suggest queries, or provide insights based on typical maize breeding scenarios.
- When users describe traits or queries, interpret them semantically—consider synonyms, related terms, and conceptual meanings.
- Provide factual, evidence-based information grounded in plant breeding principles. Avoid hallucinations; if uncertain, suggest consulting domain experts or additional data.
- Assist with tasks like formulating natural language queries and explaining trait relationships.
- Promote efficiency: Help users transition from exact keyword matching to conceptual searches, and highlight how semantic tools can improve parental line selection.
- Maintain a professional, supportive tone suitable for researchers with varying technical expertise."""

        # Prepend system message if not present
        if not messages or messages[0].get("role") != "system":
            messages = [{"role": "system", "content": system_prompt}] + messages

        try:
            text = self.processor.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
                enable_thinking=self.enable_thinking,
            )
        except TypeError:
            text = self.processor.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )

        inputs = self.processor(text=text, return_tensors="pt").to(self.model.device)
        model_inputs = self._filter_supported_model_inputs(dict(inputs))

        if stream:
            # For streaming, use TextIteratorStreamer to yield tokens
            streamer = TextIteratorStreamer(
                self.tokenizer, skip_prompt=True, skip_special_tokens=True
            )  # type: ignore

            generation_kwargs = {
                **model_inputs,
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
                    **model_inputs,
                    max_new_tokens=max_tokens,
                    temperature=0.7 if not self.enable_thinking else 0.6,
                    top_p=0.8 if not self.enable_thinking else 0.95,
                    top_k=20,
                    min_p=0.0,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id,
                )

            input_len = inputs["input_ids"].shape[-1]
            response = self.processor.decode(
                outputs[0][input_len:], skip_special_tokens=False
            )

            parse_response = getattr(self.processor, "parse_response", None)
            if callable(parse_response):
                parsed = parse_response(response)
                if isinstance(parsed, dict):
                    answer = parsed.get("response") or parsed.get("text")
                    if isinstance(answer, str) and answer.strip():
                        return answer.strip()

            return response.strip()


class GroqLLM:
    def __init__(
        self,
        model_name: str = "qwen/qwen3-32b",
        api_key: str | None = None,
    ):
        key_source = api_key if api_key is not None else os.getenv("GROQ_API_KEY")
        if key_source is None:
            key_source = ""

        resolved_api_key = key_source.strip()
        if not resolved_api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Configure it before selecting the online model."
            )

        self.api_key = resolved_api_key
        self.model_name = model_name
        self.client = Groq(api_key=self.api_key)

    def cleanup(self):
        close_method = getattr(self.client, "close", None)
        if callable(close_method):
            close_method()

    def generate_response(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
        stream: bool = False,
    ):
        system_prompt = """You are an AI assistant for the Institute of Plant Breeding, specialized in maize phenotypic trait data and parental line selection for plant breeding research. Your primary role is to help researchers, lab technicians, and breeders efficiently query and analyze phenotypic data using natural language, overcoming the limitations of traditional keyword-based searches in spreadsheets. You understand concepts like semantic similarity, dense embeddings, and retrieval-augmented generation (RAG), and you draw from knowledge of maize traits.

Key guidelines:

- Respond in a clear, concise, and helpful manner. Use natural language to explain concepts, suggest queries, or provide insights based on typical maize breeding scenarios.
- When users describe traits or queries (e.g., "varieties resistant to lodging with purple tassels"), interpret them semantically-consider synonyms, related terms, and conceptual meanings.
- Provide factual, evidence-based information grounded in plant breeding principles. Avoid hallucinations; if uncertain, suggest consulting domain experts or additional data.
- Assist with tasks like formulating natural language queries, explaining trait relationships, or simulating search results based on common maize data patterns (e.g., from synthetic datasets mirroring fields like Local Name, Kernel Type, Plant Height).
- Promote efficiency: Help users transition from exact keyword matching to conceptual searches, and highlight how semantic tools can improve parental line selection.
- Maintain a professional, supportive tone suitable for researchers with varying technical expertise."""

        if not messages or messages[0].get("role") != "system":
            messages = [{"role": "system", "content": system_prompt}] + messages

        request_kwargs: dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.7,
        }

        if stream:
            stream_response = self.client.chat.completions.create(
                **request_kwargs,
                stream=True,
            )
            for chunk in stream_response:
                choices = getattr(chunk, "choices", None)
                if not choices:
                    continue

                first_choice = choices[0]
                delta = getattr(first_choice, "delta", None)
                if delta is None:
                    continue

                content = getattr(delta, "content", None)
                if isinstance(content, str) and content:
                    yield content
            return

        completion = self.client.chat.completions.create(**request_kwargs)
        choices = getattr(completion, "choices", None)
        if not choices:
            return ""

        message = getattr(choices[0], "message", None)
        if message is None:
            return ""

        content = getattr(message, "content", None)
        if isinstance(content, str):
            return content.strip()

        return ""


# Backward-compatible alias for existing imports/usages.
QwenLLM = GemmaLLM
OpenRouterFreeLLM = GroqLLM


if __name__ == "__main__":
    llm = GemmaLLM(enable_thinking=False)
    messages = [{"role": "user", "content": "List 2 traits ideal to have in crops."}]
    response = llm.generate_response(messages, stream=True)
    full_response = "".join(response)
    print(full_response)
