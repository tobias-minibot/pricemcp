# PriceMCP workflow audit — 2026-08-29 06:59 EDT

Endpoint: local MCP `http://127.0.0.1:3199/mcp`.

1. Best current laptop resolved `apple-macbook-air-m5-13-16-512`; Apple at $1,299.00; fresh. Shipping remains explicitly unknown.
2. Trusted seller comparison for the 14-inch M5 Pro 24GB/1TB returned Best Buy at $2,299.00 and Apple at $2,499.00.
3. Mac mini generation query resolved exactly to `apple-mac-mini-m6-16-256`; Apple at $899.00; fresh.
4. Unsupported RTX 5090 query returned zero products instead of a weak false match.
5. Thirty-day history returned 98 evidence points for the MacBook Air; observed range remained $1,299.00–$1,299.00, so no price-drop claim was made.

Observed gaps: shipping and destination tax remain unknown; only five products currently have two or more trusted merchant sources; Best Buy's official API requires an operator-supplied key; Walmart and Micro Center were not added because no approved data access is configured.
