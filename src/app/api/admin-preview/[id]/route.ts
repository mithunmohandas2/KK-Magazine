import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { RequestError } from "@/lib/errors";
import { previewReaderPage, sessionCookie } from "@/lib/store";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || id.length > 100) {
    return NextResponse.json({ error: "Page unavailable." }, { status: 404, headers });
  }
  try {
    const token = (await cookies()).get(sessionCookie)?.value;
    const page = await previewReaderPage(token, id);
    return page
      ? NextResponse.json(page, { headers })
      : NextResponse.json({ error: "Page unavailable." }, { status: 404, headers });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    throw error;
  }
}
