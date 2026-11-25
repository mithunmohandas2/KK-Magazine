'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { ContactMessage } from '@/lib/data';
import { useSuccessToast } from './ToastProvider';

type Inbox = { messages: ContactMessage[]; hasMore: boolean };

export default function ContactInbox() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Inbox | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [candidate, setCandidate] = useState<ContactMessage | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const notify = useSuccessToast();

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
        if (!controller.signal.aborted) setData(result);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load reader messages.');
      }
    }
    void load();
    return () => controller.abort();
  }, [page, attempt]);

  useEffect(() => {
    if (candidate && !dialog.current?.open) dialog.current?.showModal();
  }, [candidate]);

  async function confirmDelete() {
    if (!candidate || !data || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const response = await fetch(
        `/api/contact?id=${encodeURIComponent(candidate.id)}`,
        { method: 'DELETE', headers: { 'X-KK-Request': '1' } },
      );
      if (response.status === 401) {
        window.location.assign('/login');
        return;
      }
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error || 'Could not delete the message.');
      }
      dialog.current?.close();
      setCandidate(null);
      if (page > 0 && data.messages.length === 1 && !data.hasMore) {
        goTo(page - 1);
      } else {
        setData(null);
        setAttempt((current) => current + 1);
      }
      notify('Reader message deleted.');
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete the message.');
    } finally {
      setDeleting(false);
    }
  }

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
      <div className="button-row">
        <a className="btn" href={`mailto:${encodeURIComponent(message.email)}`}>Reply by email</a>
        <button
          type="button"
          className="btn delete-action"
          aria-haspopup="dialog"
          aria-label={`Delete message from ${message.name}`}
          onClick={() => {
            setDeleteError('');
            setCandidate(message);
          }}
        >
          <Trash2 size={16} aria-hidden="true" /> Delete
        </button>
      </div>
    </article>)}
    {(page > 0 || data.hasMore) && <div className="button-row">
      <button className="btn" type="button" disabled={page === 0} onClick={() => goTo(page - 1)}>Newer messages</button>
      <button className="btn" type="button" disabled={!data.hasMore} onClick={() => goTo(page + 1)}>Older messages</button>
    </div>}
    {candidate && (
      <dialog
        ref={dialog}
        className="studio-delete-dialog panel"
        aria-labelledby="delete-message-title"
        aria-describedby="delete-message-description"
        onClose={() => setCandidate(null)}
        onCancel={(event) => {
          if (deleting) event.preventDefault();
        }}
      >
        <div className="stack">
          <h2 id="delete-message-title" className="serif">Delete reader message?</h2>
          <p id="delete-message-description">
            Permanently delete the message from <strong>{candidate.name}</strong>?
          </p>
          {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
          <div className="button-row studio-delete-actions">
            <button
              type="button"
              className="btn"
              disabled={deleting}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn danger"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? 'Deleting…' : 'Delete message'}
            </button>
          </div>
        </div>
      </dialog>
    )}
  </div>;
}
