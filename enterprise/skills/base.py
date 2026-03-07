"""Base skill interface and registry.

All skills inherit from BaseSkill and register via the @register_skill
decorator or manual SKILL_REGISTRY insertion. Skills have:
- A Pydantic params model defining inputs
- A Pydantic result model defining outputs
- An async execute() method
- An error_strategy defining failure behavior (retry/skip/abort)
"""

import enum
import logging
from abc import ABC, abstractmethod
from typing import Any, ClassVar

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ErrorStrategy(str, enum.Enum):
    """How to handle skill execution failure."""

    RETRY = "retry"      # retry up to max_retries
    SKIP = "skip"        # mark as skipped, continue workflow
    ABORT = "abort"      # abort the entire workflow


class SkillStatus(str, enum.Enum):
    """Execution status of a skill invocation."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class SkillResult(BaseModel):
    """Standardized result from any skill execution."""

    status: SkillStatus = SkillStatus.COMPLETED
    data: dict[str, Any] | None = None
    error_message: str | None = None
    screenshots: list[str] | None = None  # MinIO keys
    duration_ms: int | None = None


class BaseSkill(ABC):
    """Abstract base class for all composable skills.

    Subclasses must define:
    - skill_name: unique identifier
    - description: human-readable purpose
    - params_model: Pydantic model class for input validation
    - error_strategy: how to handle failures
    - execute(): async method that performs the skill
    """

    skill_name: ClassVar[str]
    description: ClassVar[str]
    params_model: ClassVar[type[BaseModel]]
    error_strategy: ClassVar[ErrorStrategy] = ErrorStrategy.RETRY
    max_retries: ClassVar[int] = 2

    @abstractmethod
    async def execute(
        self,
        params: BaseModel,
        context: dict[str, Any] | None = None,
    ) -> SkillResult:
        """Execute the skill with validated parameters.

        Args:
            params: Validated instance of self.params_model.
            context: Optional execution context (browser page, session, etc.).

        Returns:
            SkillResult with status and output data.
        """

    def validate_params(self, raw_params: dict[str, Any]) -> BaseModel:
        """Validate raw parameters against the skill's params model."""
        return self.params_model.model_validate(raw_params)

    def to_audit_dict(self, params: BaseModel) -> dict[str, Any]:
        """Produce an audit-safe representation (sensitive fields masked)."""
        data = params.model_dump()
        # Mask fields with 'password' or 'secret' in the name
        for key in data:
            lower_key = key.lower()
            if any(word in lower_key for word in ("password", "secret", "token", "key")):
                val = str(data[key])
                if len(val) > 4:
                    data[key] = val[0] + "*" * (len(val) - 2) + val[-1]
                else:
                    data[key] = "****"
        return {"skill": self.skill_name, "params": data}


# Global skill registry
SKILL_REGISTRY: dict[str, type[BaseSkill]] = {}


def register_skill(cls: type[BaseSkill]) -> type[BaseSkill]:
    """Decorator to register a skill class in the global registry."""
    if not hasattr(cls, "skill_name") or not cls.skill_name:
        raise ValueError(f"Skill class {cls.__name__} must define skill_name")
    SKILL_REGISTRY[cls.skill_name] = cls
    logger.debug("Registered skill: %s (%s)", cls.skill_name, cls.__name__)
    return cls


def get_skill(name: str) -> type[BaseSkill] | None:
    """Look up a skill class by name."""
    return SKILL_REGISTRY.get(name)


def list_skills() -> list[dict[str, str]]:
    """Return metadata for all registered skills."""
    return [
        {
            "name": cls.skill_name,
            "description": cls.description,
            "error_strategy": cls.error_strategy.value,
        }
        for cls in SKILL_REGISTRY.values()
    ]
