"""Three-layer resilient LLM caller.

Layer 1 (Prompt): Forces structured JSON output via system prompt + schema
Layer 2 (Parse):  Pydantic validation + markdown cleanup + exponential backoff retry
Layer 3 (Task):   After max retries, transitions task to NEEDS_HUMAN state
"""

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Exponential backoff delays (seconds)
RETRY_DELAYS = [1.0, 2.0, 4.0]
MAX_RETRIES = 3

# Regex to strip markdown code fences from LLM output
MARKDOWN_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?(.*?)\n?```\s*$", re.DOTALL)


@dataclass
class LLMCallResult:
    """Result of a resilient LLM call."""

    success: bool
    data: Any = None  # Parsed Pydantic model instance
    raw_response: str | None = None
    attempts: int = 0
    errors: list[str] = field(default_factory=list)
    needs_human: bool = False


def build_structured_prompt(
    task_description: str,
    schema_class: type[BaseModel],
    additional_context: str = "",
) -> str:
    """Build a system prompt that forces JSON output matching the schema.

    Layer 1: Prompt-level enforcement.
    """
    schema_json = json.dumps(schema_class.model_json_schema(), indent=2)

    prompt = (
        "You are a financial RPA assistant. You MUST respond with valid JSON "
        "matching the following schema. Do NOT include any text outside the JSON object.\n\n"
        f"## Required JSON Schema\n```json\n{schema_json}\n```\n\n"
    )

    if additional_context:
        prompt += f"## Context\n{additional_context}\n\n"

    prompt += f"## Task\n{task_description}\n"

    return prompt


def clean_llm_response(raw: str) -> str:
    """Strip markdown code fences and whitespace from LLM output.

    Layer 2: Parse-level cleanup.
    """
    text = raw.strip()

    # Remove markdown code fences
    match = MARKDOWN_FENCE_RE.match(text)
    if match:
        text = match.group(1).strip()

    return text


def parse_and_validate(raw: str, schema_class: type[T]) -> T:
    """Parse JSON string and validate against Pydantic schema.

    Layer 2: Parse-level validation.

    Raises:
        json.JSONDecodeError: If the response is not valid JSON.
        ValidationError: If the JSON doesn't match the schema.
    """
    cleaned = clean_llm_response(raw)
    data = json.loads(cleaned)
    return schema_class.model_validate(data)


async def call_llm_with_retry(
    llm_callable,
    prompt: str,
    schema_class: type[T],
    max_retries: int = MAX_RETRIES,
    retry_delays: list[float] | None = None,
) -> LLMCallResult:
    """Call LLM with exponential backoff retry and structured parsing.

    Layers 1+2: Prompt enforcement + parse validation + retry.

    Args:
        llm_callable: Async function(prompt: str) -> str that calls the LLM.
        prompt: The structured prompt (from build_structured_prompt).
        schema_class: Pydantic model class for response validation.
        max_retries: Maximum retry attempts.
        retry_delays: Delay between retries (seconds).

    Returns:
        LLMCallResult with success status and parsed data or error info.
    """
    if retry_delays is None:
        retry_delays = RETRY_DELAYS[:max_retries]

    result = LLMCallResult(success=False)

    for attempt in range(max_retries):
        result.attempts = attempt + 1

        try:
            raw_response = await llm_callable(prompt)
            result.raw_response = raw_response

            parsed = parse_and_validate(raw_response, schema_class)
            result.success = True
            result.data = parsed
            logger.info("LLM call succeeded on attempt %d", attempt + 1)
            return result

        except json.JSONDecodeError as e:
            error_msg = f"Attempt {attempt + 1}: JSON parse error — {e}"
            result.errors.append(error_msg)
            logger.warning(error_msg)

        except ValidationError as e:
            error_msg = f"Attempt {attempt + 1}: Schema validation error — {e}"
            result.errors.append(error_msg)
            logger.warning(error_msg)

        except Exception as e:
            error_msg = f"Attempt {attempt + 1}: LLM call error — {type(e).__name__}: {e}"
            result.errors.append(error_msg)
            logger.warning(error_msg)

        # Exponential backoff before next retry
        if attempt < max_retries - 1:
            delay = retry_delays[min(attempt, len(retry_delays) - 1)]
            logger.info("Retrying in %.1fs...", delay)
            await asyncio.sleep(delay)

    # All retries exhausted
    result.needs_human = True
    logger.error(
        "LLM call failed after %d attempts. Task needs human intervention.",
        max_retries,
    )
    return result
