import unittest
from contextlib import nullcontext
from unittest.mock import patch

from model import DIMENSIONS, Encoder
from worker import Job, run_once


class FakeModel:
    def __init__(self):
        self.inputs = []

    def encode(self, inputs, **kwargs):
        self.inputs.append((inputs, kwargs))
        return [[0.01] * DIMENSIONS for _ in inputs]


class EncoderTests(unittest.TestCase):
    def test_query_and_passage_prefixes(self):
        model = FakeModel()
        encoder = Encoder(model)
        self.assertEqual(len(encoder.encode(["  Ri6 "], "query")[0]), DIMENSIONS)
        encoder.encode(["Sầu riêng"], "passage")
        self.assertEqual(model.inputs[0][0], ["query: Ri6"])
        self.assertEqual(model.inputs[1][0], ["passage: Sầu riêng"])
        self.assertTrue(model.inputs[0][1]["normalize_embeddings"])

    def test_rejects_bad_dimension(self):
        class BadModel(FakeModel):
            def encode(self, inputs, **kwargs):
                return [[1.0, 2.0]]

        with self.assertRaises(ValueError):
            Encoder(BadModel()).encode(["Ri6"], "query")


class WorkerTests(unittest.TestCase):
    def test_batches_and_skips_stale_document(self):
        jobs = [Job(1, "lot", "lot-1", "h1", 1),
                Job(2, "buy_request", "request-1", "h2", 1),
                Job(3, "lot", "lot-3", "h3", 1)]
        documents = {1: ("Ri6", "h1"), 2: ("Mít", "old"), 3: ("Thanh long", "h3")}
        model = FakeModel()

        class Connection:
            transaction = staticmethod(nullcontext)

        with patch("worker.claim_jobs", return_value=jobs), \
                patch("worker.document_for_job", side_effect=lambda _, job: documents[job.id]), \
                patch("worker.finish_job", side_effect=lambda _, job, vector, failed=False:
                      "STALE" if vector is None and not failed else "DONE") as finish:
            self.assertEqual(run_once(Connection(), Encoder(model)), {"STALE": 1, "DONE": 2})
        self.assertEqual(model.inputs[0][0], ["passage: Ri6", "passage: Thanh long"])
        self.assertEqual(finish.call_count, 3)


if __name__ == "__main__":
    unittest.main()
