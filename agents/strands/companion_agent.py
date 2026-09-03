"""PriceMCP Companion agent built with Strands and the existing MCP server."""

from __future__ import annotations

import argparse
import os

from mcp.client.streamable_http import streamablehttp_client
from strands import Agent
from strands.models.ollama import OllamaModel
from strands.tools.mcp import MCPClient


SYSTEM_PROMPT = """You are PriceMCP Companion, a commercially skeptical decision agent.
Use PriceMCP tools for every price, availability, catalog, and ranking claim.
Never invent inventory or call a synthetic/test offer live or bookable.
Keep exact variants and complete itineraries explicit. Compare total cost and material
conditions, explain why an offer wins, and identify unknown shipping, tax, baggage,
refund, or membership terms. Do not purchase, reserve, contact a provider, or imply
that a handoff completed. Finish with the next decision the person should make.
"""


# Read-only tools only. record_decision is deliberately excluded: the agent
# explains, the human decides.
ALLOWED_TOOLS = [
    "list_catalog",
    "search_price",
    "search_products",
    "get_price",
    "compare_prices",
    "find_best_offer",
    "get_price_history",
]


def build_agent(endpoint: str, model_id: str, host: str) -> tuple[Agent, MCPClient]:
    """Create a local-model Strands agent connected to PriceMCP over Streamable HTTP."""
    client = MCPClient(
        lambda: streamablehttp_client(endpoint),
        tool_filters={"allowed": list(ALLOWED_TOOLS)},
    )
    model = OllamaModel(host=host, model_id=model_id, temperature=0.1)
    return Agent(model=model, tools=[client], system_prompt=SYSTEM_PROMPT), client


def run(request: str):
    """Run one request with settings from the environment; returns the AgentResult."""
    endpoint = os.getenv("PRICEMCP_MCP_URL", "http://127.0.0.1:3199/mcp")
    model_id = os.getenv("PRICEMCP_OLLAMA_MODEL", "qwen3:8b")
    host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
    agent, _client = build_agent(endpoint, model_id, host)
    result = agent(request)
    return result, agent


def last_tool_calls(agent: Agent) -> list[dict]:
    """Tool calls the agent made, read from its conversation history."""
    calls: list[dict] = []
    for message in agent.messages:
        for block in message.get("content", []) or []:
            if isinstance(block, dict) and "toolUse" in block:
                calls.append(block["toolUse"])
    return calls


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the PriceMCP Strands companion")
    parser.add_argument("request", nargs="+", help="The price or trip decision to research")
    args = parser.parse_args()
    result, _agent = run(" ".join(args.request))
    print(str(result))


if __name__ == "__main__":
    main()

