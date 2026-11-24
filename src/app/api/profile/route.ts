import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { profileCommand } from '@/lib/commands';
import { minimumPasswordLength } from '@/lib/data';
import { RequestError, sessionCookie, updateProfile } from '@/lib/store';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };

export async function PATCH(request: NextRequest) {
  if (request.headers.get('x-kk-request') !== '1') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 403, headers });
  }
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: 'Your session expired. Log in again.' }, { status: 401, headers });

  const command = profileCommand.safeParse(await request.json().catch(() => null));
  if (!command.success) {
    const field = command.error.issues[0]?.path[0];
    const error = field === 'name' ? 'Enter a name up to 200 characters.'
      : field === 'newPassword' ? `Use a new password between ${minimumPasswordLength} and 128 characters.`
      : field === 'currentPassword' ? 'Enter your current password.'
      : 'Invalid profile details.';
    return NextResponse.json({ error }, { status: 400, headers });
  }
  try {
    return NextResponse.json(await updateProfile(token, command.data), { headers });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    throw error;
  }
}
