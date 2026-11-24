import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { confirmMediaUpload, signMediaUpload } from '@/lib/cloud-media';
import { uploadCommand } from '@/lib/commands';
import { permissions } from '@/lib/data';
import { RequestError } from '@/lib/errors';
import { authorizeContributorPhoto, registerMedia, sessionCookie, sessionUser } from '@/lib/store';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(request: NextRequest) {
  if (request.headers.get('x-kk-request') !== '1') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 403, headers });
  }
  const token = (await cookies()).get(sessionCookie)?.value;
  const user = await sessionUser(token);
  if (!user) return NextResponse.json({ error: 'Log in to upload media.' }, { status: 401, headers });
  const command = uploadCommand.safeParse(await request.json().catch(() => null));
  if (!command.success) return NextResponse.json({ error: 'Invalid media upload details.' }, { status: 400, headers });
  if (!permissions.uploadMedia(user.role, command.data.purpose)) {
    return NextResponse.json({ error: 'Your role cannot upload this media.' }, { status: 403, headers });
  }
  try {
    const upload = command.data;
    if (upload.action === 'sign') {
      if (upload.contributorId) await authorizeContributorPhoto(user, upload.contributorId);
      return NextResponse.json(signMediaUpload(user.id, upload.kind, upload.bytes, upload.purpose, upload.contributorId), { headers });
    }
    const asset = await confirmMediaUpload(user.id, upload);
    return NextResponse.json(await registerMedia(token, asset), { headers });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    throw error;
  }
}
