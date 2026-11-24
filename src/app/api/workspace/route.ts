import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { workspaceCommand } from '@/lib/commands';
import { RequestError, runCommand, sessionCookie, sessionUser, workspace } from '@/lib/store';

export const runtime = 'nodejs';
const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  const user = await sessionUser((await cookies()).get(sessionCookie)?.value);
  if (!user) return NextResponse.json({ error: 'Log in to open the dashboard.' }, { status: 401, headers: privateHeaders });
  return NextResponse.json(await workspace(user), { headers: privateHeaders });
}

export async function POST(request: NextRequest) {
  if (request.headers.get('x-kk-request') !== '1') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 403 });
  }
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!await sessionUser(token)) return NextResponse.json({ error: 'Your session expired. Log in again.' }, { status: 401 });
  const command = workspaceCommand.safeParse(await request.json().catch(() => null));
  if (!command.success) {
    const issue = command.error.issues[0];
    return NextResponse.json({ error: `${issue.path.join(' / ')}: ${issue.message}` }, { status: 400 });
  }
  try {
    return NextResponse.json(await runCommand(token, command.data), { headers: privateHeaders });
  } catch (error) {
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
