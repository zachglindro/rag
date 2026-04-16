from pathlib import Path
import inspect
import os

import torch
from google import genai
from groq import Groq
from typing import Any
from transformers import (
    AutoModelForCausalLM,
    AutoProcessor,
    TextIteratorStreamer,
)

# Enable/disable logging for model inputs and outputs
LOGGING = False

SYSTEM_PROMPTS = {
    "general": """You are an AI assistant for the Institute of Plant Breeding, specialized in maize phenotypic trait data and parental line selection for plant breeding research. Your primary role is to help the user efficiently query and analyze phenotypic data using natural language, overcoming the limitations of traditional keyword-based searches in spreadsheets. You understand concepts like semantic similarity, dense embeddings, and retrieval-augmented generation (RAG), and you draw from knowledge of maize traits.

Key guidelines:

- Respond in a clear, concise, and helpful manner.
- Provide factual, evidence-based information grounded in plant breeding principles.
- Assist with tasks like formulating natural language queries and explaining trait relationships.
- Do not output markdown or tables.
- If there are search results, do not regurgitate them. Instead, summarize and analyze them.
- Maintain a professional, supportive tone suitable for researchers with varying technical expertise.""",
    "routing": """You are a search query generator.
Your task is to generate a concise query for the database based on the user's message.
The database contains the following columns: {database_columns}
Your query should as concise, short, and focused as possible. It should ideally contain only the column to be searched and the search term.
Output ONLY valid JSON: {'query': 'search term or none'}
No markdown. No extra text.""",
}


__all__ = [
    "GemmaLLM",
    "GroqLLM",
    "GeminiLLM",
    "QwenLLM",
    "OpenRouterFreeLLM",
]


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
        task: str = "general",
        stream: bool = False,
        database_columns: list[str] | None = None,
    ):
        system_prompt = SYSTEM_PROMPTS.get(task, SYSTEM_PROMPTS["general"])

        # Inject database columns into routing prompt if provided
        if task == "routing" and database_columns:
            columns_str = ", ".join(database_columns)
            system_prompt = system_prompt.format(database_columns=columns_str)

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

        if LOGGING:
            print("\n=== GEMMA INPUT TEXT ===")
            print(text)
            print("========================\n")

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

            if LOGGING:
                print("\n=== GEMMA STREAMING OUTPUT ===")
            # Yield tokens as they come
            for token in streamer:
                if LOGGING:
                    print(token, end="", flush=True)
                yield token
            if LOGGING:
                print("\n==============================\n")

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
                        if LOGGING:
                            print("\n=== GEMMA OUTPUT ===")
                            print(answer.strip())
                            print("====================\n")
                        return answer.strip()

            if LOGGING:
                print("\n=== GEMMA OUTPUT ===")
                print(response.strip())
                print("====================\n")
            return response.strip()


class GroqLLM:
    def __init__(
        self,
        model_name: str = "openai/gpt-oss-120b",
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

    def _extract_text(self, content: Any) -> str:
        if isinstance(content, str):
            return content

        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                    continue

                if isinstance(item, dict):
                    text_value = item.get("text")
                    if isinstance(text_value, str):
                        parts.append(text_value)

            return "".join(parts)

        return ""

    def generate_response(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
        task: str = "general",
        stream: bool = False,
        database_columns: list[str] | None = None,
    ):
        system_prompt = SYSTEM_PROMPTS.get(task, SYSTEM_PROMPTS["general"])

        # Inject database columns into routing prompt if provided
        if task == "routing" and database_columns:
            columns_str = ", ".join(database_columns)
            system_prompt = system_prompt.format(database_columns=columns_str)

        if LOGGING:
            print("\n=== GROQ INPUT (System Prompt) ===")
            print(system_prompt)
            print("=== GROQ INPUT (Messages) ===")
            for msg in messages:
                print(f"{msg['role'].upper()}: {msg['content']}")
            print("==================================\n")

        continuation_prompt = (
            "Continue exactly where you stopped. Start with the next word only, "
            "without repeating prior text."
        )
        max_continuations = 2

        if stream:
            conversation = list(messages)
            for attempt in range(max_continuations + 1):
                request_kwargs: dict[str, Any] = {
                    "model": self.model_name,
                    "messages": conversation,
                    "max_tokens": max_tokens,
                    "temperature": 0.7,
                }

                stream_response = self.client.chat.completions.create(
                    **request_kwargs,
                    stream=True,
                )

                if LOGGING and attempt == 0:
                    print("\n=== GROQ STREAMING OUTPUT ===")

                finish_reason = ""
                chunk_texts: list[str] = []
                for chunk in stream_response:
                    choices = getattr(chunk, "choices", None)
                    if not choices:
                        continue

                    first_choice = choices[0]
                    reason = getattr(first_choice, "finish_reason", None)
                    if isinstance(reason, str) and reason:
                        finish_reason = reason

                    delta = getattr(first_choice, "delta", None)
                    if delta is None:
                        continue

                    content = getattr(delta, "content", None)
                    text = self._extract_text(content)
                    if text:
                        chunk_texts.append(text)
                        if LOGGING:
                            print(text, end="", flush=True)
                        yield text

                partial_text = "".join(chunk_texts).strip()
                if partial_text:
                    conversation.append({"role": "assistant", "content": partial_text})

                if finish_reason != "length" or attempt >= max_continuations:
                    break

                conversation.append({"role": "user", "content": continuation_prompt})

            if LOGGING:
                print("\n============================\n")
            return

        conversation = list(messages)
        response_parts: list[str] = []
        for attempt in range(max_continuations + 1):
            request_kwargs = {
                "model": self.model_name,
                "messages": conversation,
                "max_tokens": max_tokens,
                "temperature": 0.7,
            }

            completion = self.client.chat.completions.create(**request_kwargs)
            choices = getattr(completion, "choices", None)
            if not choices:
                break

            first_choice = choices[0]
            finish_reason = getattr(first_choice, "finish_reason", "")

            message = getattr(first_choice, "message", None)
            if message is None:
                break

            content = getattr(message, "content", None)
            text = self._extract_text(content).strip()
            if text:
                response_parts.append(text)
                conversation.append({"role": "assistant", "content": text})

            if finish_reason != "length" or attempt >= max_continuations:
                break

            conversation.append({"role": "user", "content": continuation_prompt})

        full_response = "".join(response_parts).strip()
        if LOGGING:
            print("\n=== GROQ OUTPUT ===")
            print(full_response)
            print("===================\n")
        return full_response


class GeminiLLM:
    def __init__(
        self,
        model_name: str = "gemini-3-flash-preview",
        api_key: str | None = None,
    ):
        key_source = api_key if api_key is not None else os.getenv("GEMINI_API_KEY")
        if key_source is None:
            key_source = ""

        resolved_api_key = key_source.strip()
        if not resolved_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Configure it before selecting Gemini Online."
            )

        self.api_key = resolved_api_key
        self.model_name = model_name
        self.client = genai.Client(api_key=self.api_key)

    def cleanup(self):
        close_method = getattr(self.client, "close", None)
        if callable(close_method):
            close_method()

    def _build_prompt(
        self,
        messages: list[dict[str, str]],
        task: str,
        database_columns: list[str] | None = None,
    ) -> str:
        system_prompt = SYSTEM_PROMPTS.get(task, SYSTEM_PROMPTS["general"])

        # Inject database columns into routing prompt if provided
        if task == "routing" and database_columns:
            columns_str = ", ".join(database_columns)
            system_prompt = system_prompt.format(database_columns=columns_str)

        content_lines = [f"SYSTEM: {system_prompt}"]

        for message in messages:
            role = message.get("role", "user").upper()
            content = message.get("content", "")
            content_lines.append(f"{role}: {content}")

        return "\n\n".join(content_lines)

    def _extract_stream_text(self, chunk: Any) -> str:
        text_value = getattr(chunk, "text", None)
        if isinstance(text_value, str):
            return text_value

        candidates = getattr(chunk, "candidates", None)
        if not candidates:
            return ""

        first_candidate = candidates[0]
        content = getattr(first_candidate, "content", None)
        parts = getattr(content, "parts", None)
        if not parts:
            return ""

        texts: list[str] = []
        for part in parts:
            part_text = getattr(part, "text", None)
            if isinstance(part_text, str) and part_text:
                texts.append(part_text)

        return "".join(texts)

    def generate_response(
        self,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
        task: str = "general",
        stream: bool = False,
        database_columns: list[str] | None = None,
    ):
        prompt = self._build_prompt(messages, task, database_columns)

        if LOGGING:
            print("\n=== GEMINI INPUT PROMPT ===")
            print(prompt)
            print("============================\n")

        if stream:
            stream_response = self.client.models.generate_content_stream(
                model=self.model_name,
                contents=prompt,
                config={"max_output_tokens": max_tokens},
            )

            if LOGGING:
                print("\n=== GEMINI STREAMING OUTPUT ===")

            for chunk in stream_response:
                text = self._extract_stream_text(chunk)
                if text:
                    if LOGGING:
                        print(text, end="", flush=True)
                    yield text

            if LOGGING:
                print("\n================================\n")
            return

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config={"max_output_tokens": max_tokens},
        )
        response_text = getattr(response, "text", None)
        if isinstance(response_text, str) and response_text.strip():
            if LOGGING:
                print("\n=== GEMINI OUTPUT ===")
                print(response_text.strip())
                print("=====================\n")
            return response_text.strip()
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
