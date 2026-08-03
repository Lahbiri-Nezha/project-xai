import { NextRequest, NextResponse } from "next/server";
import { initOpenTelemetry } from "@/lib/otel";

async function getServeHandler() {
  initOpenTelemetry();
  const { serve } = await import("inngest/next");
  const { inngest } = await import("@/lib/inngest/client");
  const { scoreLeadsFunction } = await import("@/lib/inngest/functions/score-leads");
  const { enrichCompanyFunction } = await import("@/lib/inngest/functions/enrich-company");
  const { scheduledSyncFunction } = await import("@/lib/inngest/functions/scheduled-sync");
  const { detectSignalsFunction } = await import("@/lib/inngest/functions/detect-signals");
  const { savedSearchCheckFunction } = await import("@/lib/inngest/functions/saved-search-check");
  const { retentionPurgeFunction } = await import("@/lib/inngest/functions/retention-purge");

  return serve({
    client: inngest,
    functions: [
      scoreLeadsFunction,
      enrichCompanyFunction,
      scheduledSyncFunction,
      detectSignalsFunction,
      savedSearchCheckFunction,
      retentionPurgeFunction,
    ],
  });
}

export async function GET(request: NextRequest, context: unknown) {
  try {
    const handler = await getServeHandler();
    return handler.GET(request, context);
  } catch {
    return NextResponse.json({ error: "Inngest not configured" }, { status: 503 });
  }
}

export async function POST(request: NextRequest, context: unknown) {
  try {
    const handler = await getServeHandler();
    return handler.POST(request, context);
  } catch {
    return NextResponse.json({ error: "Inngest not configured" }, { status: 503 });
  }
}

export async function PUT(request: NextRequest, context: unknown) {
  try {
    const handler = await getServeHandler();
    return handler.PUT(request, context);
  } catch {
    return NextResponse.json({ error: "Inngest not configured" }, { status: 503 });
  }
}
