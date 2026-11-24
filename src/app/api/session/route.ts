import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { signInInput } from '@/lib/commands';
import { endSession, login, sessionCookie, sessionLifetime } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (request.headers.get('x-kk-request') !== '1') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 403 });
  }
  const values = signInInput.safeParse(await request.json().catch(() => null));
  if (!values.success) return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 });
  const token = await login(values.data.email, values.data.password);
  if (!token) return NextResponse.json({ error: 'Unable to log in with those credentials. Try again shortly.' }, { status: 401 });
  const jar = await cookies();
  await endSession(jar.get(sessionCookie)?.value);
  jar.set(sessionCookie, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:' || process.env.KK_SECURE_COOKIES === 'true',
    path: '/',
    maxAge: sessionLifetime,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  if (request.headers.get('x-kk-request') !== '1') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 403 });
  }
  const jar = await cookies();
  await endSession(jar.get(sessionCookie)?.value);
  jar.delete(sessionCookie);
  return NextResponse.json({ ok: true });
}
