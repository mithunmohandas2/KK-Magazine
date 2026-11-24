import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { mediaDeliveryUrl } from '@/lib/cloud-media';
import { mediaId } from '@/lib/commands';
import { RequestError } from '@/lib/errors';
import { deleteLibraryImage, deliverableMedia, sessionCookie } from '@/lib/store';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = mediaId.safeParse((await params).id);
  if (!id.success) return new Response(null, { status: 404, headers });
  const asset = await deliverableMedia(id.data, (await cookies()).get(sessionCookie)?.value);
  if (!asset) return new Response(null, { status: 404, headers });
  try {
    return NextResponse.redirect(mediaDeliveryUrl(asset), { headers });
  } catch (error) {
    if (error instanceof RequestError) return new Response(null, { status: error.status, headers });
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get('x-kk-request') !== '1') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 403, headers });
  }
  const id = mediaId.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: 'Invalid image.' }, { status: 400, headers });
  try {
    await deleteLibraryImage((await cookies()).get(sessionCookie)?.value, id.data);
    return new Response(null, { status: 204, headers });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    throw error;
  }
}
