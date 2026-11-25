import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { RequestError } from '@/lib/errors';
import { contactInbox, deleteContactMessage, sessionCookie, submitContact } from '@/lib/store';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
const contactInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  message: z.string().trim().min(1).max(3000),
  website: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  if (request.headers.get('x-kk-request') !== '1') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 403, headers });
  }
  const input = contactInput.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: 'Enter your name, a valid email, and a message.' }, { status: 400, headers });
  const { website, ...message } = input.data;
  try {
    if (!website) await submitContact(message);
    return NextResponse.json({ ok: true }, { status: 201, headers });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const page = z.coerce.number().int().min(0).max(100000).safeParse(request.nextUrl.searchParams.get('page') ?? '0');
  if (!page.success) return NextResponse.json({ error: 'Invalid inbox page.' }, { status: 400, headers });
  try {
    const token = (await cookies()).get(sessionCookie)?.value;
    if (!token) return NextResponse.json({ error: 'Log in to view reader messages.' }, { status: 401, headers });
    return NextResponse.json(await contactInbox(token, page.data), { headers });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  if (request.headers.get('x-kk-request') !== '1') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 403, headers });
  }
  const id = z.uuid().safeParse(request.nextUrl.searchParams.get('id'));
  if (!id.success) {
    return NextResponse.json({ error: 'Invalid message ID.' }, { status: 400, headers });
  }
  try {
    const token = (await cookies()).get(sessionCookie)?.value;
    await deleteContactMessage(token, id.data);
    return new Response(null, { status: 204, headers });
  } catch (error) {
    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status, headers });
    }
    throw error;
  }
}
