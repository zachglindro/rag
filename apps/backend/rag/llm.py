from pathlib import Path
import inspect
import json
import os

import httpx
import torch
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


class OpenRouterFreeLLM:
    def __init__(
        self,
        model_name: str = "openrouter/free",
        api_key: str | None = None,
    ):
        key_source = api_key if api_key is not None else os.getenv("OPENROUTER_API_KEY")
        if key_source is None:
            key_source = ""

        resolved_api_key = key_source.strip()
        if not resolved_api_key:
            raise RuntimeError(
                "OPENROUTER_API_KEY is not set. Configure it before selecting the online model."
            )

        self.api_key = resolved_api_key
        self.model_name = model_name
        site_url = os.getenv("OPENROUTER_SITE_URL")
        site_name = os.getenv("OPENROUTER_SITE_NAME")
        self.site_url = (site_url or "").strip()
        self.site_name = (site_name or "").strip()
        self.client = httpx.Client(
            base_url="https://openrouter.ai/api/v1",
            timeout=httpx.Timeout(120.0),
        )

    def cleanup(self):
        self.client.close()

    def _request_headers(self) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        if self.site_url:
            headers["HTTP-Referer"] = self.site_url

        if self.site_name:
            headers["X-Title"] = self.site_name

        return headers

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

        payload: dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.7,
        }

        if stream:
            payload["stream"] = True
            with self.client.stream(
                "POST",
                "/chat/completions",
                headers=self._request_headers(),
                json=payload,
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line:
                        continue
                    if not line.startswith("data:"):
                        continue

                    data_str = line[5:].strip()
                    if data_str == "[DONE]":
                        break

                    try:
                        payload_obj = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue

                    error_obj = payload_obj.get("error")
                    if error_obj:
                        raise RuntimeError(str(error_obj))

                    choices = payload_obj.get("choices")
                    if not isinstance(choices, list) or not choices:
                        continue

                    first_choice = choices[0]
                    if not isinstance(first_choice, dict):
                        continue

                    delta = first_choice.get("delta")
                    if not isinstance(delta, dict):
                        continue

                    content = delta.get("content")
                    if isinstance(content, str) and content:
                        yield content
            return

        response = self.client.post(
            "/chat/completions",
            headers=self._request_headers(),
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            return ""

        message = choices[0].get("message")
        if not isinstance(message, dict):
            return ""

        content = message.get("content")
        if isinstance(content, str):
            return content.strip()

        if isinstance(content, list):
            text_chunks = []
            for item in content:
                if not isinstance(item, dict):
                    continue
                if item.get("type") == "text" and isinstance(item.get("text"), str):
                    text_chunks.append(item["text"])
            return "".join(text_chunks).strip()

        return ""


# Backward-compatible alias for existing imports/usages.
QwenLLM = GemmaLLM


if __name__ == "__main__":
    llm = GemmaLLM(enable_thinking=False)
    messages = [{"role": "user", "content": "List 2 traits ideal to have in crops."}]
    response = llm.generate_response(messages, stream=True)
    full_response = "".join(response)
    print(full_response)
