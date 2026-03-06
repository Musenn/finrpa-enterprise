"""Enterprise ID generators, reusing Skyvern's distributed ID system."""

from skyvern.forge.sdk.db.id import generate_id

# Prefixes for enterprise entities
DEPARTMENT_PREFIX = "dept"
BUSINESS_LINE_PREFIX = "bl"
ENTERPRISE_USER_PREFIX = "eu"
SPECIAL_PERMISSION_PREFIX = "sp"
TASK_EXTENSION_PREFIX = "te"


def generate_department_id() -> str:
    return f"{DEPARTMENT_PREFIX}_{generate_id()}"


def generate_business_line_id() -> str:
    return f"{BUSINESS_LINE_PREFIX}_{generate_id()}"


def generate_enterprise_user_id() -> str:
    return f"{ENTERPRISE_USER_PREFIX}_{generate_id()}"


def generate_special_permission_id() -> str:
    return f"{SPECIAL_PERMISSION_PREFIX}_{generate_id()}"


def generate_task_extension_id() -> str:
    return f"{TASK_EXTENSION_PREFIX}_{generate_id()}"
