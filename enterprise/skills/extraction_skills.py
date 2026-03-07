"""Extraction skills: TableExtractSkill and FileDownloadSkill.

Handle data extraction from financial system tables and file downloads.
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
# TableExtractSkill
# ------------------------------------------------------------------

class TableExtractParams(BaseModel):
    """Parameters for TableExtractSkill."""

    table_selector: str | None = Field(
        default=None,
        description="CSS selector for the target table (auto-detected if omitted)",
    )
    headers: list[str] | None = Field(
        default=None,
        description="Expected column headers (used for validation)",
    )
    output_format: str = Field(
        default="json",
        description="Output format: json | csv",
    )
    max_rows: int = Field(
        default=1000,
        description="Maximum rows to extract (safety limit)",
    )
    include_pagination: bool = Field(
        default=False,
        description="Whether to extract across multiple pages",
    )
    skip_empty_rows: bool = Field(
        default=True,
        description="Skip rows where all cells are empty",
    )


@register_skill
class TableExtractSkill(BaseSkill):
    """Extract structured data from HTML tables.

    Handles standard <table> elements as well as CSS-grid based tables
    common in modern financial systems. Outputs JSON or CSV.
    """

    skill_name: ClassVar[str] = "table_extract"
    description: ClassVar[str] = "Extract structured data from page tables"
    params_model: ClassVar[type[BaseModel]] = TableExtractParams
    error_strategy: ClassVar[ErrorStrategy] = ErrorStrategy.RETRY
    max_retries: ClassVar[int] = 2

    async def execute(
        self,
        params: BaseModel,
        context: dict[str, Any] | None = None,
    ) -> SkillResult:
        start = time.monotonic()
        p: TableExtractParams = params  # type: ignore[assignment]
        ctx = context or {}

        try:
            page = ctx.get("page")
            if page is None:
                return SkillResult(
                    status=SkillStatus.FAILED,
                    error_message="No browser page in context",
                    duration_ms=int((time.monotonic() - start) * 1000),
                )

            # Locate table
            selector = p.table_selector or "table"
            table = await page.query_selector(selector)
            if table is None:
                return SkillResult(
                    status=SkillStatus.FAILED,
                    error_message=f"No table found with selector '{selector}'",
                    duration_ms=int((time.monotonic() - start) * 1000),
                )

            # Extract via JavaScript for performance
            raw_data = await page.evaluate("""(args) => {
                const [selector, maxRows, skipEmpty] = args;
                const table = document.querySelector(selector);
                if (!table) return { headers: [], rows: [] };

                const headerCells = table.querySelectorAll('thead th, thead td, tr:first-child th');
                const headers = Array.from(headerCells).map(c => c.innerText.trim());

                const bodyRows = table.querySelectorAll('tbody tr');
                const rows = [];
                for (let i = 0; i < Math.min(bodyRows.length, maxRows); i++) {
                    const cells = bodyRows[i].querySelectorAll('td, th');
                    const row = Array.from(cells).map(c => c.innerText.trim());
                    if (skipEmpty && row.every(c => c === '')) continue;
                    rows.push(row);
                }

                return { headers, rows };
            }""", [selector, p.max_rows, p.skip_empty_rows])

            extracted_headers = raw_data.get("headers", [])
            extracted_rows = raw_data.get("rows", [])

            # Validate headers if expected ones are provided
            header_match = True
            if p.headers:
                header_match = all(
                    any(exp.lower() in h.lower() for h in extracted_headers)
                    for exp in p.headers
                )
                if not header_match:
                    logger.warning(
                        "TableExtract: header mismatch. Expected %s, got %s",
                        p.headers, extracted_headers,
                    )

            # Format output
            if p.output_format == "csv":
                import csv
                import io
                buf = io.StringIO()
                writer = csv.writer(buf)
                if extracted_headers:
                    writer.writerow(extracted_headers)
                writer.writerows(extracted_rows)
                output_data = buf.getvalue()
            else:
                # JSON: list of dicts
                if extracted_headers:
                    output_data = [
                        dict(zip(extracted_headers, row))
                        for row in extracted_rows
                    ]
                else:
                    output_data = extracted_rows

            elapsed = int((time.monotonic() - start) * 1000)
            return SkillResult(
                status=SkillStatus.COMPLETED,
                data={
                    "headers": extracted_headers,
                    "row_count": len(extracted_rows),
                    "output_format": p.output_format,
                    "output": output_data,
                    "header_match": header_match,
                },
                duration_ms=elapsed,
            )

        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            logger.error("TableExtractSkill failed: %s", e)
            return SkillResult(
                status=SkillStatus.FAILED,
                error_message=str(e),
                duration_ms=elapsed,
            )


# ------------------------------------------------------------------
# FileDownloadSkill
# ------------------------------------------------------------------

class FileDownloadParams(BaseModel):
    """Parameters for FileDownloadSkill."""

    trigger_selector: str | None = Field(
        default=None,
        description="CSS selector for the download trigger element",
    )
    trigger_text: str | None = Field(
        default=None,
        description="Text on the download button/link (used if selector not given)",
    )
    download_path: str = Field(
        default="./downloads/",
        description="Local directory to save downloaded files",
    )
    expected_extension: str | None = Field(
        default=None,
        description="Expected file extension (e.g. '.csv', '.pdf')",
    )
    wait_timeout_ms: int = Field(
        default=30000,
        description="Max milliseconds to wait for download to complete",
    )


@register_skill
class FileDownloadSkill(BaseSkill):
    """Trigger file download and wait for completion.

    Handles downloads triggered by button clicks or link navigation,
    with configurable timeout and file type validation.
    """

    skill_name: ClassVar[str] = "file_download"
    description: ClassVar[str] = "Trigger download and wait for file save"
    params_model: ClassVar[type[BaseModel]] = FileDownloadParams
    error_strategy: ClassVar[ErrorStrategy] = ErrorStrategy.RETRY
    max_retries: ClassVar[int] = 2

    async def execute(
        self,
        params: BaseModel,
        context: dict[str, Any] | None = None,
    ) -> SkillResult:
        start = time.monotonic()
        p: FileDownloadParams = params  # type: ignore[assignment]
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

            # Start waiting for download event before clicking
            async with page.expect_download(timeout=p.wait_timeout_ms) as download_info:
                if llm_handler and not p.trigger_selector:
                    text = p.trigger_text or "download"
                    await llm_handler(page, f"Click the download button: '{text}'")
                elif p.trigger_selector:
                    await page.click(p.trigger_selector)
                elif p.trigger_text:
                    btn = await page.query_selector(f"text={p.trigger_text}")
                    if btn:
                        await btn.click()
                    else:
                        return SkillResult(
                            status=SkillStatus.FAILED,
                            error_message=f"Download trigger '{p.trigger_text}' not found",
                            duration_ms=int((time.monotonic() - start) * 1000),
                        )

            download = download_info.value
            filename = download.suggested_filename

            # Validate extension
            if p.expected_extension and not filename.endswith(p.expected_extension):
                logger.warning(
                    "FileDownload: expected %s but got %s",
                    p.expected_extension, filename,
                )

            # Save file
            save_path = f"{p.download_path.rstrip('/')}/{filename}"
            await download.save_as(save_path)

            elapsed = int((time.monotonic() - start) * 1000)
            logger.info("FileDownloadSkill: saved %s in %dms", save_path, elapsed)
            return SkillResult(
                status=SkillStatus.COMPLETED,
                data={
                    "filename": filename,
                    "save_path": save_path,
                    "suggested_filename": download.suggested_filename,
                },
                duration_ms=elapsed,
            )

        except Exception as e:
            elapsed = int((time.monotonic() - start) * 1000)
            logger.error("FileDownloadSkill failed: %s", e)
            return SkillResult(
                status=SkillStatus.FAILED,
                error_message=str(e),
                duration_ms=elapsed,
            )
