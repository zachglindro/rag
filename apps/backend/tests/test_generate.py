from unittest.mock import Mock

from fastapi.testclient import TestClient
from main import app, get_llm


class TestGenerateEndpoint:
    def test_generate_successful_response(self):
        """Test successful generation of response."""
        # Mock the QwenLLM instance
        mock_llm = Mock()
        mock_llm.generate_response.return_value = "This is a generated response."

        # Override the get_llm dependency
        def override_get_llm():
            return mock_llm

        app.dependency_overrides[get_llm] = override_get_llm

        client = TestClient(app)

        try:
            response = client.post(
                "/generate",
                json={"query": "What is plant breeding?", "max_tokens": 512},
            )

            assert response.status_code == 200
            data = response.json()
            assert "response" in data
            assert data["response"] == "This is a generated response."

            # Verify the mock was called correctly
            mock_llm.generate_response.assert_called_once_with(
                "What is plant breeding?", 512
            )
        finally:
            # Clean up the override
            app.dependency_overrides.pop(get_llm, None)

    def test_generate_with_default_max_tokens(self):
        """Test generation with default max_tokens."""
        mock_llm = Mock()
        mock_llm.generate_response.return_value = "Default tokens response."

        def override_get_llm():
            return mock_llm

        app.dependency_overrides[get_llm] = override_get_llm

        client = TestClient(app)

        try:
            response = client.post("/generate", json={"query": "Test query"})

            assert response.status_code == 200
            data = response.json()
            assert data["response"] == "Default tokens response."

            # Should use default max_tokens=1024
            mock_llm.generate_response.assert_called_once_with("Test query", 1024)
        finally:
            app.dependency_overrides.pop(get_llm, None)

    def test_generate_llm_exception(self):
        """Test handling of exceptions from LLM."""
        mock_llm = Mock()
        mock_llm.generate_response.side_effect = Exception("LLM generation failed")

        def override_get_llm():
            return mock_llm

        app.dependency_overrides[get_llm] = override_get_llm

        client = TestClient(app)

        try:
            response = client.post(
                "/generate", json={"query": "Test query", "max_tokens": 256}
            )

            assert response.status_code == 500
            data = response.json()
            assert "detail" in data
            assert "LLM generation failed" in data["detail"]
        finally:
            app.dependency_overrides.pop(get_llm, None)

    def test_generate_empty_query(self):
        """Test generation with empty query."""
        mock_llm = Mock()
        mock_llm.generate_response.return_value = "Response to empty query."

        def override_get_llm():
            return mock_llm

        app.dependency_overrides[get_llm] = override_get_llm

        client = TestClient(app)

        try:
            response = client.post("/generate", json={"query": "", "max_tokens": 128})

            assert response.status_code == 200
            data = response.json()
            assert data["response"] == "Response to empty query."

            mock_llm.generate_response.assert_called_once_with("", 128)
        finally:
            app.dependency_overrides.pop(get_llm, None)

    def test_generate_large_max_tokens(self):
        """Test generation with large max_tokens value."""
        mock_llm = Mock()
        mock_llm.generate_response.return_value = "Long response."

        def override_get_llm():
            return mock_llm

        app.dependency_overrides[get_llm] = override_get_llm

        client = TestClient(app)

        try:
            response = client.post(
                "/generate", json={"query": "Long query", "max_tokens": 4096}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["response"] == "Long response."

            mock_llm.generate_response.assert_called_once_with("Long query", 4096)
        finally:
            app.dependency_overrides.pop(get_llm, None)
