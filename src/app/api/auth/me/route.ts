import { NextResponse } from "next/server";
import { getUser } from "@/lib/session";
import type { MeResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getUser();
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json<MeResponse>({
    user: auth.user,
    boxId: auth.boxId,
  });
}
