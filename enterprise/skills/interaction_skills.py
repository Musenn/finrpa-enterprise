"""Interaction skills: FormFillSkill, SearchAndSelectSkill, PaginationSkill.

Handle common UI interaction patterns across financial systems.
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
# FormFillSkill
# ------------------------------------------------------------------

class FormFillParams(BaseModel):
    """Parameters for the FormFillSkill."""

    field_mapping: dict[str, str] = Field(
        description="Mapping of field label/name -> value to fill",
    )
    submit_after_fill: bool = Field(
        default=True,
        description="Whether to click submit after filling all fields",
    )
    submit_selector: str | None = Field(
        default=None,
        description="CSS selector for submit button (auto-detected if omitted)",
    )
    date_format: str = Field(
        default="YYYY-MM-DD",
        description="Date format for date picker fields",
    )


@register_skill
class FormFillSkill(BaseSkill):
    """Smart form filling with support for dropdowns and date pickers.

    Uses LLM-guided element detection to handle non-standard form controls
    common in financial systems (custom dropdowns, date pickers, etc.).
    """

    skill_name: ClassVar[str] = "form_fill"
    description: ClassVar[str] = "Intelligent form filling with dropdown and date picker support"
    params_model: ClassVar[type[BaseModel]] = FormFillParams
    error_strategy: ClassVar[ErrorStrategy] = ErrorStrategy.RETRY
    max_retries: ClassVar[int] = 2

    async def execute(
        self,
        params: BaseModel,
        context: dict[str, Any] | None = None,
    ) -> SkillResult:
        start = time.monotonic()
        p: FormFillParams = params  # type: ignore[assignment]
        ctx = context or {}

        try:
            page = ctx.get("page")
            if page is None:
                return SkillResult(
                    status=SkillStatus.FAILED,
                    error_message="No browser page in context",
                    duration_ms=int((time.monotonic() - start) * 1000),
                )

            filled_fields: list[str] = []
            failed_fields: list[str] = []

            llm_handler = ctx.get("llm_handler")

            for field_label, value in p.field_mapping.items():
                try:
                    if llm_handler:
                        goal = f"Fill the form field labeled '{field_label}' with value '{value}'"
                        await llm_handler(page, goal)
                    else:
                        # Fallback: try common selectors
                        selectors = [
                            f"input[name='{field_label}']",
                            f"input[placeholder*='{field_label}']",
                            f"textarea[name='{field_label}']",
                            f"select[name='{field_label}']",
                        ]
                        filled = False
                        for sel in selectors:
                            try:
                                element = await page.query_selector(sel)
                                if element:
                                    tag = await element.evaluate("el => el.tagName.toLowerCase()")
                                    if tag == "select":
                                        await page.select_option(sel, value)
                                    else:
                                        await page.fill(sel, value)
                                    filled = True
                                    break
                            except Exception:
                                continue
                        if not filled:
                            failed_fields.append(field_label)
                            continue

                    filled_fields.append(field_label)
                except Exception as e:
                    logger.warning("FormFill: failed to fill '%s': %s", field_label, e)
                    failed_fields.append(field_label)

            # Submit if requested
            if p.submit_after_fill and not failed_fields:
                try:
                    if p.submit_selector:
                        await page.click(p.submit_selector)
                    elif llm_handler:
                        await llm_handler(page, "Click the submit or confirm button")
                    else:
                        await page.click("button[type='submit'], input[type='submit']")
                except Exception as e:
                    logger.warning("FormFill: submit click failed: %s", e)

            elapsed = int((time.monotonic() - start) * 1000)
            status = SkillStatus.COMPLETED if not failed_fields else SkillStatus.FAILED
            return SkillResult(
                status=status,
                data={
                    "filled_fields": filled_fields,
                    "failed_fields": failed_fields,
                    "total": len(p.field_mapping),
                },
                error_message=f"Failed to fill: {failed_fields}" if failed_fields else None,
                duration_ms=elapsed,
            )

        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            logger.error("FormFillSkill failed: %s", e)
            return SkillResult(
                status=SkillStatus.FAILED,
                error_message=str(e),
                duration_ms=elapsed,
            )


# ------------------------------------------------------------------
# SearchAndSelectSkill
# ------------------------------------------------------------------

class SearchAndSelectParams(BaseModel):
    """Parameters for SearchAndSelectSkill."""

    search_text: str = Field(description="Text to enter in the search box")
    target_text: str = Field(
        description="Text of the result item to select/click",
    )
    search_selector: str | None = Field(
        default=None,
        description="CSS selector for search input (auto-detected if omitted)",
    )
    result_container_selector: str | None = Field(
        default=None,
        description="CSS selector for results container",
    )
    wait_for_results_ms: int = Field(
        default=3000,
        description="Milliseconds to wait for search results to appear",
    )


@register_skill
class SearchAndSelectSkill(BaseSkill):
    """Search for an item and select from results.

    Common in financial systems for client lookup, product search,
    account selection, etc.
    """

    skill_name: ClassVar[str] = "search_and_select"
    description: ClassVar[str] = "Search and select item from results list"
    params_model: ClassVar[type[BaseModel]] = SearchAndSelectParams
    error_strategy: ClassVar[ErrorStrategy] = ErrorStrategy.RETRY
    max_retries: ClassVar[int] = 2

    async def execute(
        self,
        params: BaseModel,
        context: dict[str, Any] | None = None,
    ) -> SkillResult:
        start = time.monotonic()
        p: SearchAndSelectParams = params  # type: ignore[assignment]
        ctx = context or {}

        try:
            page = ctx.get("page")
            if page is None:
                return SkillResult(
                    status=SkillStatus.FAILED,
                    error_message="No browser page in context",
                    duration_ms=int((time.monotonic() - start) * 1000),
                )

            llm_handler = ctx.get("llm_handler")

            # Step 1: Enter search text
            if llm_handler:
                await llm_handler(
                    page,
                    f"Find the search box, type '{p.search_text}', and trigger search",
                )
            elif p.search_selector:
                await page.fill(p.search_selector, p.search_text)
                await page.keyboard.press("Enter")
            else:
                await page.fill("input[type='search'], input[type='text']", p.search_text)
                await page.keyboard.press("Enter")

            # Step 2: Wait for results
            await page.wait_for_timeout(p.wait_for_results_ms)

            # Step 3: Select target
            if llm_handler:
                await llm_handler(
                    page,
                    f"Click on the search result that contains '{p.target_text}'",
                )
            else:
                target = await page.query_selector(f"text={p.target_text}")
                if target:
                    await target.click()
                else:
                    return SkillResult(
                        status=SkillStatus.FAILED,
                        error_message=f"Target '{p.target_text}' not found in results",
                        duration_ms=int((time.monotonic() - start) * 1000),
                    )

            elapsed = int((time.monotonic() - start) * 1000)
            return SkillResult(
                status=SkillStatus.COMPLETED,
                data={"search_text": p.search_text, "selected": p.target_text},
                duration_ms=elapsed,
            )

        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            logger.error("SearchAndSelectSkill failed: %s", e)
            return SkillResult(
                status=SkillStatus.FAILED,
                error_message=str(e),
                duration_ms=elapsed,
            )


# ------------------------------------------------------------------
# PaginationSkill
# ------------------------------------------------------------------

class PaginationParams(BaseModel):
    """Parameters for PaginationSkill."""

    max_pages: int = Field(
        default=10,
        description="Maximum number of pages to traverse",
    )
    next_button_selector: str | None = Field(
        default=None,
        description="CSS selector for the 'Next' button",
    )
    next_button_text: str = Field(
        default="下一页",
        description="Text on the next page button (used if selector not given)",
    )
    page_data_selector: str | None = Field(
        default=None,
        description="CSS selector for the data container on each page",
    )
    wait_between_pages_ms: int = Field(
        default=2000,
        description="Wait time between page navigations",
    )
    stop_on_empty: bool = Field(
        default=True,
        description="Stop pagination when no data is found on a page",
    )


@register_skill
class PaginationSkill(BaseSkill):
    """Traverse multiple pages and collect data from each.

    Handles various pagination styles (numbered, next button, infinite scroll)
    commonly found in financial system data tables.
    """

    skill_name: ClassVar[str] = "pagination"
    description: ClassVar[str] = "Multi-page traversal with data collection"
    params_model: ClassVar[type[BaseModel]] = PaginationParams
    error_strategy: ClassVar[ErrorStrategy] = ErrorStrategy.SKIP
    max_retries: ClassVar[int] = 1

    async def execute(
        self,
        params: BaseModel,
        context: dict[str, Any] | None = None,
    ) -> SkillResult:
        start = time.monotonic()
        p: PaginationParams = params  # type: ignore[assignment]
        ctx = context or {}

        try:
            page = ctx.get("page")
            if page is None:
                return SkillResult(
                    status=SkillStatus.FAILED,
                    error_message="No browser page in context",
                    duration_ms=int((time.monotonic() - start) * 1000),
                )

            pages_traversed = 0
            page_data_collection: list[str] = []
            llm_handler = ctx.get("llm_handler")

            for i in range(p.max_pages):
                pages_traversed += 1

                # Collect data from current page
                if p.page_data_selector:
                    elements = await page.query_selector_all(p.page_data_selector)
                    page_text = [await el.inner_text() for el in elements]
                    if p.stop_on_empty and not page_text:
                        logger.info("PaginationSkill: empty page at %d, stopping", i + 1)
                        break
                    page_data_collection.extend(page_text)

                # Navigate to next page
                if i < p.max_pages - 1:
                    try:
                        if llm_handler:
                            await llm_handler(page, f"Click '{p.next_button_text}' to go to next page")
                        elif p.next_button_selector:
                            btn = await page.query_selector(p.next_button_selector)
                            if btn:
                                is_disabled = await btn.evaluate(
                                    "el => el.disabled || el.classList.contains('disabled')"
                                )
                                if is_disabled:
                                    break
                                await btn.click()
                            else:
                                break
                        else:
                            btn = await page.query_selector(f"text={p.next_button_text}")
                            if btn:
                                await btn.click()
                            else:
                                break

                        await page.wait_for_timeout(p.wait_between_pages_ms)
                    except Exception as e:
                        logger.info("PaginationSkill: pagination ended at page %d: %s", i + 1, e)
                        break

            elapsed = int((time.monotonic() - start) * 1000)
            return SkillResult(
                status=SkillStatus.COMPLETED,
                data={
                    "pages_traversed": pages_traversed,
                    "items_collected": len(page_data_collection),
                    "data": page_data_collection,
                },
                duration_ms=elapsed,
            )

        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            logger.error("PaginationSkill failed: %s", e)
            return SkillResult(
                status=SkillStatus.FAILED,
                error_message=str(e),
                duration_ms=elapsed,
            )
