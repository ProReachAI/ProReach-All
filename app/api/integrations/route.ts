import { NextResponse } from "next/server";
import { listConnections } from "@/lib/integrations/repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ connections: await listConnections() });
  } catch (error) {
    console.error("Integration list failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to load integrations." }, { status: 500 });
  }
}
