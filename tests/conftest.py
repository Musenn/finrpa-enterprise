"""Shared test fixtures for FinRPA Enterprise."""

import pytest


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"
