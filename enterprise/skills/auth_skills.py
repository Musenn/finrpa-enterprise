"""Authentication skills: LoginSkill and SessionKeepAliveSkill.

These handle common login flows and session management across
all financial systems (banking, insurance, securities portals).
"""

import logging
import time
from typing import Any, ClassVar

from pydantic import BaseModel, Field

from .base import (
    BaseSkill,
    ErrorStrategy,
    SkillResult,
    SkillStatus,
    register_skill,
)

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# LoginSkill
# ------------------------------------------------------------------

class LoginParams(BaseModel):
    """Parameters for the LoginSkill."""

    url: str = Field(description="Login page URL")
    username: str = Field(description="Login username")
    password: str = Field(description="Login password")
    captcha_strategy: str = Field(
        default="skip",
        description="How to handle captcha: skip | manual | ocr",
    )
    submit_selector: str | None = Field(
        default=None,
        description="Optional CSS selector for the submit button",
    )
    success_indicator: str = Field(
        default="",
        description="Text or URL fragment that confirms successful login",
    )


@register_skill
class LoginSkill(BaseSkill):
    """Generic login skill for financial system portals.

    Navigates to login page, fills credentials, handles optional captcha,
    and verifies login success via a configurable indicator.
    """

    skill_name: ClassVar[str] = "login"
    description: ClassVar[str] = "Universal login flow with captcha handling"
    params_model: ClassVar[type[BaseModel]] = LoginParams
    error_strategy: ClassVar[ErrorStrategy] = ErrorStrategy.ABORT
    max_retries: ClassVar[int] = 3

    async def execute(
        self,
        params: BaseModel,
        context: dict[str, Any] | None = None,
    ) -> SkillResult:
        start = time.monotonic()
        p: LoginParams = params  # type: ignore[assignment]
        ctx = context or {}

        try:
            page = ctx.get("page")
            if page is None:
                return SkillResult(
                    status=SkillStatus.FAILED,
                    error_message="No browser page in context",
                    duration_ms=int((time.monotonic() - start) * 1000),
                )

            # Step 1: Navigate to login page
            await page.goto(p.url, wait_until="domcontentloaded")
            logger.info("LoginSkill: navigated to %s", p.url)

            # Step 2: Fill credentials using LLM-guided element detection
            navigation_goal = (
                f"Fill username '{p.username}' and password into login form fields, "
                f"then click submit"
            )
            llm_handler = ctx.get("llm_handler")
            if llm_handler:
                await llm_handler(page, navigation_goal)
            else:
                # Fallback: direct selector-based fill
                await page.fill("input[type='text'], input[name*='user']", p.username)
                await page.fill("input[type='password']", p.password)
                if p.submit_selector:
                    await page.click(p.submit_selector)
                else:
                    await page.click("button[type='submit'], input[type='submit']")

            # Step 3: Handle captcha if needed
            if p.captcha_strategy == "manual":
                return SkillResult(
                    status=SkillStatus.PENDING,
                    data={"needs_captcha": True, "strategy": "manual"},
                    duration_ms=int((time.monotonic() - start) * 1000),
                )

            # Step 4: Verify success
            if p.success_indicator:
                try:
                    await page.wait_for_url(f"**{p.success_indicator}**", timeout=10000)
                except Exception:
                    content = await page.content()
                    if p.success_indicator not in content:
                        return SkillResult(
                            status=SkillStatus.FAILED,
                            error_message=f"Login success indicator '{p.success_indicator}' not found",
                            duration_ms=int((time.monotonic() - start) * 1000),
                        )

            elapsed = int((time.monotonic() - start) * 1000)
            logger.info("LoginSkill: login succeeded in %dms", elapsed)
            return SkillResult(
                status=SkillStatus.COMPLETED,
                data={"logged_in": True, "url": p.url},
                duration_ms=elapsed,
            )

        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            logger.error("LoginSkill failed: %s", e)
            return SkillResult(
                status=SkillStatus.FAILED,
                error_message=str(e),
                duration_ms=elapsed,
            )


# ------------------------------------------------------------------
# SessionKeepAliveSkill
# ------------------------------------------------------------------

class SessionKeepAliveParams(BaseModel):
    """Parameters for the SessionKeepAliveSkill."""

    check_interval_seconds: int = Field(
        default=300,
        description="Seconds between keep-alive checks",
    )
    heartbeat_url: str | None = Field(
        default=None,
        description="URL to ping for keep-alive (if available)",
    )
    session_timeout_indicator: str = Field(
        default="",
        description="Text that indicates session has expired (e.g. 'session expired')",
    )
    relogin_on_expire: bool = Field(
        default=True,
        description="Whether to re-execute login on session expiry",
    )
    login_params: LoginParams | None = Field(
        default=None,
        description="Login parameters for automatic re-login",
    )


@register_skill
class SessionKeepAliveSkill(BaseSkill):
    """Keep browser session alive and handle automatic re-login.

    Periodically pings a heartbeat URL or checks page content for
    session expiry indicators. Re-authenticates if needed.
    """

    skill_name: ClassVar[str] = "session_keep_alive"
    description: ClassVar[str] = "Session monitoring with auto re-login on timeout"
    params_model: ClassVar[type[BaseModel]] = SessionKeepAliveParams
    error_strategy: ClassVar[ErrorStrategy] = ErrorStrategy.RETRY
    max_retries: ClassVar[int] = 2

    async def execute(
        self,
        params: BaseModel,
        context: dict[str, Any] | None = None,
    ) -> SkillResult:
        start = time.monotonic()
        p: SessionKeepAliveParams = params  # type: ignore[assignment]
        ctx = context or {}

        try:
            page = ctx.get("page")
            if page is None:
                return SkillResult(
                    status=SkillStatus.FAILED,
                    error_message="No browser page in context",
                    duration_ms=int((time.monotonic() - start) * 1000),
                )

            # Check heartbeat URL
            if p.heartbeat_url:
                response = await page.evaluate(
                    f"fetch('{p.heartbeat_url}').then(r => r.status)"
                )
                if response != 200:
                    logger.warning("Session heartbeat failed: status=%s", response)
                    if p.relogin_on_expire and p.login_params:
                        login_skill = LoginSkill()
                        result = await login_skill.execute(p.login_params, context)
                        return result

            # Check page content for session timeout indicator
            if p.session_timeout_indicator:
                content = await page.content()
                if p.session_timeout_indicator.lower() in content.lower():
                    logger.warning("Session expired (indicator found in page)")
                    if p.relogin_on_expire and p.login_params:
                        login_skill = LoginSkill()
                        result = await login_skill.execute(p.login_params, context)
                        return result
                    return SkillResult(
                        status=SkillStatus.FAILED,
                        error_message="Session expired and no re-login configured",
                        duration_ms=int((time.monotonic() - start) * 1000),
                    )

            elapsed = int((time.monotonic() - start) * 1000)
            return SkillResult(
                status=SkillStatus.COMPLETED,
                data={"session_active": True},
                duration_ms=elapsed,
            )

        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            logger.error("SessionKeepAliveSkill failed: %s", e)
            return SkillResult(
                status=SkillStatus.FAILED,
                error_message=str(e),
                duration_ms=elapsed,
            )
