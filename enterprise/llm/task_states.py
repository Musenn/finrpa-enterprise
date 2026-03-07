"""Extended task state machine for enterprise RPA.

Adds enterprise-specific states to Skyvern's base task lifecycle:
- PENDING_APPROVAL: task blocked waiting for human approval
- NEEDS_HUMAN: AI cannot proceed, requires human intervention
- PAUSED: manually paused by operator
"""

import enum


class EnterpriseTaskStatus(str, enum.Enum):
    """Complete task status enum (Skyvern base + enterprise extensions)."""

    # --- Skyvern base states ---
    CREATED = "created"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TERMINATED = "terminated"
    TIMED_OUT = "timed_out"
    CANCELED = "canceled"

    # --- Enterprise extensions ---
    PENDING_APPROVAL = "pending_approval"
    NEEDS_HUMAN = "needs_human"
    PAUSED = "paused"


# Valid state transitions
VALID_TRANSITIONS: dict[str, set[str]] = {
    EnterpriseTaskStatus.CREATED.value: {
        EnterpriseTaskStatus.QUEUED.value,
        EnterpriseTaskStatus.CANCELED.value,
    },
    EnterpriseTaskStatus.QUEUED.value: {
        EnterpriseTaskStatus.RUNNING.value,
        EnterpriseTaskStatus.CANCELED.value,
    },
    EnterpriseTaskStatus.RUNNING.value: {
        EnterpriseTaskStatus.COMPLETED.value,
        EnterpriseTaskStatus.FAILED.value,
        EnterpriseTaskStatus.TERMINATED.value,
        EnterpriseTaskStatus.TIMED_OUT.value,
        EnterpriseTaskStatus.PENDING_APPROVAL.value,
        EnterpriseTaskStatus.NEEDS_HUMAN.value,
        EnterpriseTaskStatus.PAUSED.value,
    },
    EnterpriseTaskStatus.PENDING_APPROVAL.value: {
        EnterpriseTaskStatus.RUNNING.value,      # approved -> resume
        EnterpriseTaskStatus.TERMINATED.value,    # rejected
        EnterpriseTaskStatus.TIMED_OUT.value,     # approval timeout
    },
    EnterpriseTaskStatus.NEEDS_HUMAN.value: {
        EnterpriseTaskStatus.RUNNING.value,       # human skips/completes step
        EnterpriseTaskStatus.TERMINATED.value,    # human terminates
    },
    EnterpriseTaskStatus.PAUSED.value: {
        EnterpriseTaskStatus.RUNNING.value,       # resume
        EnterpriseTaskStatus.TERMINATED.value,    # terminate while paused
    },
    # Terminal states — no outgoing transitions
    EnterpriseTaskStatus.COMPLETED.value: set(),
    EnterpriseTaskStatus.FAILED.value: set(),
    EnterpriseTaskStatus.TERMINATED.value: set(),
    EnterpriseTaskStatus.TIMED_OUT.value: set(),
    EnterpriseTaskStatus.CANCELED.value: set(),
}

# Terminal states
TERMINAL_STATES = {
    EnterpriseTaskStatus.COMPLETED.value,
    EnterpriseTaskStatus.FAILED.value,
    EnterpriseTaskStatus.TERMINATED.value,
    EnterpriseTaskStatus.TIMED_OUT.value,
    EnterpriseTaskStatus.CANCELED.value,
}

# States that require human attention
HUMAN_ATTENTION_STATES = {
    EnterpriseTaskStatus.PENDING_APPROVAL.value,
    EnterpriseTaskStatus.NEEDS_HUMAN.value,
    EnterpriseTaskStatus.PAUSED.value,
}


class InvalidTransitionError(Exception):
    """Raised when attempting an invalid state transition."""

    def __init__(self, current_state: str, target_state: str):
        self.current_state = current_state
        self.target_state = target_state
        super().__init__(
            f"Invalid state transition: {current_state} -> {target_state}"
        )


def validate_transition(current_state: str, target_state: str) -> bool:
    """Check if a state transition is valid.

    Returns True if valid, raises InvalidTransitionError if not.
    """
    allowed = VALID_TRANSITIONS.get(current_state, set())
    if target_state not in allowed:
        raise InvalidTransitionError(current_state, target_state)
    return True
