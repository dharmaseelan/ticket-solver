import { NextResponse } from "next/server";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const HUBSPOT_MCP = "https://mcp.hubspot.com/anthropic";
const ACCOUNT_ID = "145552907";

// Excluded pipeline stages (Resolved + Closed variants)
const EXCLUDED_STAGES = ["3", "4", "879262660"];

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set in .env.local" }, { status: 500 });
  }

  const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!hubspotToken) {
    return NextResponse.json({ error: "HUBSPOT_ACCESS_TOKEN not set in .env.local" }, { status: 500 });
  }

  try {
    const response = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-1-5",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `Using HubSpot account ${ACCOUNT_ID}:
1. Call get_user_details to find the current authenticated user and their hubspot_owner_id.
2. Call search_crm_objects for object type "tickets" with filter: hubspot_owner_id equals that owner ID.
3. Exclude any tickets where hs_pipeline_stage is in [${EXCLUDED_STAGES.join(", ")}].
4. For each ticket include: id, subject (hs_ticket_name or subject), body (content or hs_ticket_body), hs_pipeline_stage, associated company name, hs_createdate.
5. Sort by hs_createdate descending (newest first).
Return ONLY a JSON array. No markdown, no explanation.`,
          },
        ],
        mcp_servers: [
          {
            type: "url",
            url: HUBSPOT_MCP,
            name: "hubspot",
            authorization_token: hubspotToken,
          },
        ],
      }),
    });

    const data = await response.json();

    // Extract tool results and text blocks from the response
    const blocks = data.content || [];
    const toolResults = blocks
      .filter((b: { type: string }) => b.type === "mcp_tool_result")
      .map((b: { content?: { text?: string }[] }) => b.content?.[0]?.text || "")
      .join("\n");
    const textBlocks = blocks
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text?: string }) => b.text || "")
      .join("\n");

    const raw = toolResults || textBlocks;

    // Parse the JSON array out of the response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "No ticket data returned", raw }, { status: 502 });
    }

    const tickets = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ tickets });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
