import { NextRequest, NextResponse } from "next/server";
import { Ticket } from "@/app/types";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `You are a senior Sourceflow developer assistant.
Sourceflow projects use: Next.js 16, React 18/19, Bootstrap 5 or Tailwind CSS v4, SASS/CSS Modules or Tailwind, @sourceflow-uk packages (SDK, job-search, forms, tracker, page-builder, head).
Components live in src/components or src/sections.

Assess each HubSpot support ticket. For each, decide:
- difficulty: "quick" (< 30 min, clear code fix), "medium" (30min–2h, needs some investigation), "complex" (needs deep investigation or design decision)
- reason: one concise sentence explaining why
- suggestedFix: for "quick" tickets only — describe the likely fix in 1–2 sentences

Return ONLY a JSON array. Each object must have: id, difficulty, reason, suggestedFix (empty string if not quick).
No markdown, no explanation, no code fences.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set in .env.local" }, { status: 500 });
  }

  const { tickets }: { tickets: Ticket[] } = await req.json();

  if (!tickets?.length) {
    return NextResponse.json({ error: "No tickets provided" }, { status: 400 });
  }

  try {
    const response = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Triage these tickets:\n${JSON.stringify(
              tickets.map((t) => ({
                id: t.id,
                subject: t.subject,
                body: t.body || "(no description provided)",
                company: t.company,
              })),
              null,
              2
            )}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const raw = data.content?.find((b: { type: string }) => b.type === "text")?.text || "";

    // Parse JSON array from response
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse triage response", raw }, { status: 502 });
    }

    const triage = JSON.parse(jsonMatch[0]);

    // Merge triage results back onto original tickets
    const triaged = tickets.map((t) => {
      const result = triage.find((r: { id: string }) => String(r.id) === String(t.id)) || {};
      return { ...t, ...result };
    });

    return NextResponse.json({ tickets: triaged });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
