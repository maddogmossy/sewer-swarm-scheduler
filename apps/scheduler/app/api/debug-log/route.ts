import { NextResponse } from "next/server";
import { appendFile } from "node:fs/promises";

export const runtime = "nodejs";

const WORKSPACE_DEBUG_LOG_PATH =
  "c:\\Users\\mike.moss\\Downloads\\Scheduler\\debug-d4c22d.log";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return new NextResponse(null, { status: 204 });
    }

    // Only accept payloads for this debug session.
    if ((body as any).sessionId !== "d4c22d") {
      return new NextResponse(null, { status: 204 });
    }

    await appendFile(WORKSPACE_DEBUG_LOG_PATH, `${JSON.stringify(body)}\n`, "utf8");
  } catch {
    // Never fail the app due to debug logging.
  }

  return new NextResponse(null, { status: 204 });
}

