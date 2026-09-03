"""Tests for the Strands companion. Unit tests need no network; the e2e test
runs only when PRICEMCP_E2E=1 and a PriceMCP server plus Ollama are reachable."""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import companion_agent  # noqa: E402

REPO = Path(__file__).resolve().parents[3]


def test_allowlist_is_read_only_and_exists_on_server():
    """Every allowlisted tool must be registered in src/mcp.ts, and the write
    tool record_decision must never be exposed to the agent."""
    src = (REPO / "src" / "mcp.ts").read_text()
    registered = set(re.findall(r"registerTool\('([a-z_]+)'", src))
    assert companion_agent.ALLOWED_TOOLS, "allowlist must not be empty"
    missing = set(companion_agent.ALLOWED_TOOLS) - registered
    assert not missing, f"allowlisted tools missing from server: {missing}"
    assert "record_decision" not in companion_agent.ALLOWED_TOOLS


def test_system_prompt_forbids_transactions():
    prompt = companion_agent.SYSTEM_PROMPT.lower()
    for word in ("do not purchase", "reserve", "synthetic"):
        assert word in prompt


@pytest.mark.skipif(os.getenv("PRICEMCP_E2E") != "1", reason="set PRICEMCP_E2E=1")
def test_e2e_price_query_uses_tools():
    result, agent = companion_agent.run("Find the best trustworthy price for AirPods Pro 3")
    assert "$" in str(result)
    tools_used = {t["name"] for t in companion_agent.last_tool_calls(agent)}
    assert tools_used & {"search_products", "get_price", "find_best_offer"}
