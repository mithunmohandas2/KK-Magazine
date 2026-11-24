'use client';

import { useEffect, useState } from 'react';
import type { ContactMessage } from '@/lib/data';

type Inbox = { messages: ContactMessage[]; hasMore: boolean };

export default function ContactInbox() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Inbox | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/contact?page=${page}`, { cache: 'no-store', signal: controller.signal });
        if (response.status === 401) {
          window.location.assign('/login');
          return;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setData(result);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load reader messages.');
      }
    }
    void load();
    return () => controller.abort();
  }, [page, attempt]);

  function goTo(next: number) {
    setData(null);
    setError('');
    setPage(next);
  }

  if (error) return <div className="stack">
    <p className="form-error" role="alert">{error}</p>
    <div><button className="btn" type="button" onClick={() => { setError(''); setAttempt(attempt + 1); }}>Try again</button></div>
  </div>;
  if (!data) return <p className="muted" role="status">Loading reader messages…</p>;

  return <div className="stack">
    {!data.messages.length && <p className="panel muted">No reader messages on this page.</p>}
    {data.messages.map(message => <article className="panel stack inbox-message" key={message.id}>
      <div>
        <strong>{message.name}</strong>
        <div className="muted text-sm">{message.email}</div>
      </div>
      <time className="muted text-xs" dateTime={new Date(message.createdAt).toISOString()}>
        {new Date(message.createdAt).toLocaleString()}
      </time>
      <p>{message.message}</p>
      <div><a className="btn" href={`mailto:${encodeURIComponent(message.email)}`}>Reply by email</a></div>
    </article>)}
    {(page > 0 || data.hasMore) && <div className="button-row">
      <button className="btn" type="button" disabled={page === 0} onClick={() => goTo(page - 1)}>Newer messages</button>
      <button className="btn" type="button" disabled={!data.hasMore} onClick={() => goTo(page + 1)}>Older messages</button>
    </div>}
  </div>;
}
