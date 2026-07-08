import os
import unittest
from unittest.mock import patch

os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017/krishna_vaani")

import app as backend_app


class GuidanceConsistencyTests(unittest.TestCase):
    def setUp(self):
        backend_app._MONGO_AVAILABLE = True
        self.client = backend_app.app.test_client()

    def test_guidance_uses_same_verse_for_payload_and_message(self):
        first_verse = {
            "chapter_number": 4,
            "chapter_title": "Jñāna Karma Sannyāsa Yoga",
            "chapter_verse": "4.29",
            "verse_number": 29,
            "translation": "The breath is offered to the breath.",
            "what_happen": "A calm mind steadies the breath.",
            "krishna_vaani": "Verse one speaks to the breath.",
            "guidance": "Guide one: steady the breath.",
        }
        second_verse = {
            "chapter_number": 2,
            "chapter_title": "Sāṅkhya Yoga",
            "chapter_verse": "2.47",
            "verse_number": 47,
            "translation": "You have the right to action, not to its fruits.",
            "what_happen": "Let go of obsession with outcomes.",
            "krishna_vaani": "Verse two is about action.",
            "guidance": "Guide two: let go of outcomes.",
        }

        call_count = {"value": 0}

        def fake_verse_for_emotion(emotion, user_input=""):
            call_count["value"] += 1
            return first_verse if call_count["value"] == 1 else second_verse

        def fake_insert_document(collection, document):
            return {"id": "stored-id", **document}

        with patch.object(backend_app, "_detect_emotion", return_value=("Stress/Tension", 0.9, {})), \
             patch.object(backend_app, "_verse_for_emotion", side_effect=fake_verse_for_emotion), \
             patch.object(backend_app, "_insert_document", side_effect=fake_insert_document), \
             patch.object(backend_app, "get_user_inputs_collection", return_value=object()):
            response = self.client.post("/api/guidance", json={"input": "I feel overwhelmed"})

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["gita_guidance"]["krishna_vaani"], first_verse["krishna_vaani"])
        self.assertEqual(payload["krishna_vaani"], f"{first_verse['krishna_vaani']} {first_verse['guidance']}")


if __name__ == "__main__":
    unittest.main()
