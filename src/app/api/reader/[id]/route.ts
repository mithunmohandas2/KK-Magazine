import { NextResponse } from "next/server";
import { publicReaderPage } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const page = id && id.length <= 100 ? await publicReaderPage(id) : null;
  const headers = { "Cache-Control": "no-store" };
  return page
    ? NextResponse.json(page, { headers })
    : NextResponse.json(
        { error: "This page is unavailable." },
        { status: 404, headers },
      );
}
