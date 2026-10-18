import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch

from fastapi.testclient import TestClient
from api import create_app
from model import DIMENSIONS, MODEL_VERSION

TOKEN = "test-only-not-a-real-secret-00000000"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}
PAYLOAD = {"text": "Sầu riêng Ri6", "kind": "query", "modelVersion": MODEL_VERSION}


class FakeEncoder:
    def encode(self, texts, kind):
        return [[1.0] + [0.0] * (DIMENSIONS - 1) for _ in texts]


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {"EMBEDDING_SERVICE_TOKEN": TOKEN, "EMBEDDING_WARMUP": "1"})
        self.environment.start()

    def tearDown(self):
        self.environment.stop()

    def test_auth_and_readiness_without_loading_real_model(self):
        with TestClient(create_app(FakeEncoder)) as client:
            self.assertEqual(client.get("/health/live").status_code, 200)
            self.assertEqual(client.get("/health/ready").status_code, 401)
            self.assertEqual(client.get("/health/ready", headers=HEADERS).json()["dimensions"], 768)
            self.assertEqual(client.post("/embed", json=PAYLOAD).status_code, 401)
            result = client.post("/embed", headers=HEADERS, json=PAYLOAD)
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()["modelVersion"], MODEL_VERSION)
            self.assertEqual(len(result.json()["vector"]), 768)

    def test_input_validation_and_model_gate(self):
        with TestClient(create_app(FakeEncoder)) as client:
            for payload, status in [({**PAYLOAD, "text": " "}, 422),
                                    ({**PAYLOAD, "text": "a" * 601}, 422),
                                    ({**PAYLOAD, "kind": "passage"}, 400),
                                    ({**PAYLOAD, "modelVersion": "other"}, 400)]:
                self.assertEqual(client.post("/embed", json=payload, headers=HEADERS).status_code, status)

    def test_startup_rejects_missing_token(self):
        with patch.dict(os.environ, {"EMBEDDING_SERVICE_TOKEN": ""}):
            with self.assertRaisesRegex(RuntimeError, "TOKEN"):
                with TestClient(create_app(FakeEncoder)):
                    pass

    def test_lazy_readiness_and_sanitized_failure(self):
        def fail():
            raise RuntimeError("secret-or-user-input-must-not-leak")
        with patch.dict(os.environ, {"EMBEDDING_WARMUP": "0"}):
            with TestClient(create_app(fail)) as client:
                self.assertEqual(client.get("/health/ready", headers=HEADERS).status_code, 503)
                response = client.post("/embed", json=PAYLOAD, headers=HEADERS)
                self.assertEqual(response.status_code, 503)
                self.assertNotIn("must-not-leak", response.text)

    def test_overlapping_queries_return_busy_instead_of_unbounded_queue(self):
        entered, release = Event(), Event()
        class SlowEncoder(FakeEncoder):
            def encode(self, texts, kind):
                entered.set()
                release.wait(5)
                return super().encode(texts, kind)
        with patch.dict(os.environ, {"EMBEDDING_WARMUP": "0"}):
            with TestClient(create_app(SlowEncoder)) as client, ThreadPoolExecutor(1) as pool:
                first = pool.submit(client.post, "/embed", json=PAYLOAD, headers=HEADERS)
                try:
                    self.assertTrue(entered.wait(3))
                    second = client.post("/embed", json=PAYLOAD, headers=HEADERS)
                    self.assertEqual(second.status_code, 429)
                    self.assertEqual(second.headers["Retry-After"], "1")
                finally:
                    release.set()
                self.assertEqual(first.result().status_code, 200)
