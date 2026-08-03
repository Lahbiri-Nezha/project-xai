import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { fetchRequestHandler } = await import("@trpc/server/adapters/fetch");
    const { appRouter } = await import("@/lib/trpc/router");
    const { createTRPCContext } = await import("@/lib/trpc/server");
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req: request,
      router: appRouter,
      createContext: createTRPCContext,
    });
  } catch {
    return NextResponse.json(
      { error: "tRPC service not configured" },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { fetchRequestHandler } = await import("@trpc/server/adapters/fetch");
    const { appRouter } = await import("@/lib/trpc/router");
    const { createTRPCContext } = await import("@/lib/trpc/server");
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req: request,
      router: appRouter,
      createContext: createTRPCContext,
    });
  } catch {
    return NextResponse.json(
      { error: "tRPC service not configured" },
      { status: 503 }
    );
  }
}
