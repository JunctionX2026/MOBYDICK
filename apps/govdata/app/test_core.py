import json
import os
import unittest
from unittest.mock import patch

from app.core import (
    PLAN_OUTPUT_SCHEMA,
    _ai_enabled,
    _openai_plan_payload,
    _responses_output_text,
)


class OpenAIPlannerContractTests(unittest.TestCase):
    def test_ai_planner_requires_openai_provider_and_api_key(self) -> None:
        with patch.dict(
            os.environ,
            {
                "GOVDATA_AI_ENABLED": "true",
                "GOVDATA_AI_PROVIDER": "openai",
                "OPENAI_API_KEY": "test-key",
            },
            clear=False,
        ):
            self.assertTrue(_ai_enabled())

        with patch.dict(
            os.environ,
            {
                "GOVDATA_AI_ENABLED": "true",
                "GOVDATA_AI_PROVIDER": "other",
                "OPENAI_API_KEY": "test-key",
            },
            clear=False,
        ):
            self.assertFalse(_ai_enabled())

    def test_responses_payload_uses_gpt_5_6_luna_and_strict_schema(self) -> None:
        with patch.dict(
            os.environ,
            {
                "OPENAI_API_MODEL": "gpt-5.6-luna",
                "OPENAI_REASONING_EFFORT": "low",
            },
            clear=False,
        ):
            payload = _openai_plan_payload("planning context")

        self.assertEqual(payload["model"], "gpt-5.6-luna")
        self.assertEqual(payload["reasoning"], {"effort": "low"})
        self.assertEqual(payload["text"]["format"]["type"], "json_schema")
        self.assertTrue(payload["text"]["format"]["strict"])
        self.assertEqual(payload["text"]["format"]["schema"], PLAN_OUTPUT_SCHEMA)
        self.assertEqual(payload["input"][1]["content"], "planning context")

    def test_responses_output_text_reads_structured_output_item(self) -> None:
        payload = {
            "output": [
                {
                    "type": "message",
                    "content": [
                        {"type": "output_text", "text": json.dumps({"title": "demo"})},
                    ],
                },
            ],
        }

        self.assertEqual(_responses_output_text(payload), '{"title": "demo"}')


if __name__ == "__main__":
    unittest.main()
