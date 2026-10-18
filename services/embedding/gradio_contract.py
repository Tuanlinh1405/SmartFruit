"""Validate/authenticate before requesting ZeroGPU time."""
import secrets
from model import MODEL_VERSION


def validate_request(payload, supplied_token, expected_token):
    if not isinstance(expected_token, str) or len(expected_token) < 32:
        raise ValueError("Service not configured")
    if not isinstance(supplied_token, str) or not secrets.compare_digest(
            supplied_token.encode(), expected_token.encode()):
        raise ValueError("Unauthorized")
    if not isinstance(payload, dict) or payload.get('modelVersion') != MODEL_VERSION:
        raise ValueError("Unsupported model")
    texts, kind = payload.get('texts'), payload.get('kind')
    if kind not in ('query', 'passage') or not isinstance(texts, list) or not 1 <= len(texts) <= 16:
        raise ValueError("Invalid embedding input")
    max_length = 600 if kind == 'query' else 8000
    if any(not isinstance(text, str) or not text.strip() or len(text) > max_length for text in texts):
        raise ValueError("Invalid embedding text")
    if kind == 'query' and len(texts) != 1:
        raise ValueError("Query requires one text")
    return [text.strip() for text in texts], kind
