'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, UserRound, X } from 'lucide-react';
import { mediaUrl, type User } from '@/lib/data';
import ProfileDialog from './ProfileDialog';

export default function StudioAccount({ user, busy, uploadsEnabled, onLogout, onUpdated }: {
  user: User;
  busy: boolean;
  uploadsEnabled: boolean;
  onLogout: () => void;
  onUpdated: (user: User, detailsChanged: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const account = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const firstLetter = user.name.match(/\p{L}/u)?.[0] ?? '?';
  const initial = Array.from(firstLetter.toUpperCase())[0];
  const photo = user.profile?.photoAssetId ? mediaUrl(user.profile.photoAssetId) : user.profile?.photo;
  const avatar = photo && photo !== failedPhoto ? <img src={photo} alt="" onError={() => setFailedPhoto(photo)} /> : initial;

  function dismiss() {
    setOpen(false);
    trigger.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !account.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return <div className="studio-account" ref={account}>
    <button type="button" className="studio-avatar" ref={trigger} aria-label={`Account for ${user.name}`}
      aria-expanded={open} aria-controls="studio-account-details" onClick={() => setOpen(!open)}>{avatar}</button>
    <section className="studio-account-details" id="studio-account-details" aria-label="Your account" hidden={!open}>
      <div className="studio-account-profile">
        <span className="studio-avatar" aria-hidden="true">{avatar}</span>
        <div>
          <strong>{user.name}</strong>
          <p className="studio-account-role">{user.role}</p>
          <p className="studio-account-email">{user.email}</p>
        </div>
        <button type="button" className="studio-icon-button" aria-label="Close account details" onClick={dismiss}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="studio-profile-menu" aria-haspopup="dialog" disabled={busy} onClick={() => {
        dismiss();
        setShowProfile(true);
      }}>
        <UserRound size={17} aria-hidden="true" /> Profile
      </button>
      <button type="button" className="studio-logout" onClick={onLogout} disabled={busy}>
        <LogOut size={17} aria-hidden="true" /> Log out
      </button>
    </section>
    {showProfile && <ProfileDialog user={user} uploadsEnabled={uploadsEnabled} onUpdated={onUpdated} onClose={() => {
      setShowProfile(false);
      trigger.current?.focus();
    }} />}
  </div>;
}
