import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import LoginForm from '@/components/LoginForm';
import { magazineName } from '@/lib/data';
import { sessionCookie, sessionUser } from '@/lib/store';

export const metadata = { title: `Login | ${magazineName}` };

export default async function Login() {
  if (await sessionUser((await cookies()).get(sessionCookie)?.value)) redirect('/dashboard');
  return <main className="login-page">
    <Link className="wordmark" href="/" aria-label="Return to Mozhi magazine"><span lang="ml">{magazineName}</span></Link>
    <div className="login-card">
      <h1 className="serif">Editorial login</h1>
      <LoginForm />
    </div>
    <Link className="login-back" href="/">Back to magazine</Link>
  </main>;
}
