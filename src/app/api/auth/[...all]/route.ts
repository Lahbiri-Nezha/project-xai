import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { auth } = await import("@/lib/auth");
    return auth.handler(request);
  } catch {
    return NextResponse.json(
      { error: "Auth service not configured" },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { auth } = await import("@/lib/auth");
    return auth.handler(request);
  } catch {
    return NextResponse.json(
      { error: "Auth service not configured" },
      { status: 503 }
    );
  }
}
