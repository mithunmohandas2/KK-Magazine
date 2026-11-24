'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { ProfileCommand } from '@/lib/commands';
import { mediaUrl, minimumPasswordLength, type User } from '@/lib/data';
import MediaUpload from './MediaUpload';
import { useSuccessToast } from './ToastProvider';

type ProfileAction = Exclude<ProfileCommand['action'], 'rename'>;

export default function ProfileDialog({ user, uploadsEnabled, onClose, onUpdated }: {
  user: User;
  uploadsEnabled: boolean;
  onClose: () => void;
  onUpdated: (user: User, detailsChanged: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(user.name);
  const [credit, setCredit] = useState(user.profile?.credit ?? '');
  const [bio, setBio] = useState(user.profile?.bio ?? '');
  const [photo, setPhoto] = useState(user.profile?.photo ?? '');
  const [photoAssetId, setPhotoAssetId] = useState(user.profile?.photoAssetId);
  const [saving, setSaving] = useState<ProfileAction | null>(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ action: ProfileAction; text: string } | null>(null);
  const notify = useSuccessToast();
  const busy = Boolean(saving) || uploading;
  const photoSource = photoAssetId ? mediaUrl(photoAssetId) : /^https?:\/\//i.test(photo.trim()) ? photo.trim() : '';
  const dirty = name.trim() !== user.name || credit.trim() !== (user.profile?.credit ?? '')
    || bio.trim() !== (user.profile?.bio ?? '') || photo.trim() !== (user.profile?.photo ?? '')
    || photoAssetId !== user.profile?.photoAssetId;

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>, action: ProfileAction) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const newPassword = String(fields.get('newPassword') ?? '');
    if (action === 'changePassword' && newPassword !== fields.get('confirmPassword')) {
      setFeedback({ action, text: 'The new passwords do not match.' });
      return;
    }
    const command: ProfileCommand = action === 'updateDetails'
      ? { action, name, credit, bio, photo: photoAssetId ? '' : photo.trim(), photoAssetId }
      : { action, currentPassword: String(fields.get('currentPassword') ?? ''), newPassword };

    setSaving(action);
    setFeedback(null);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-KK-Request': '1' },
        body: JSON.stringify(command),
      });
      if (response.status === 401) {
        window.location.assign('/login');
        return;
      }
      if (!response.ok) throw new Error((await response.json()).error);
      const updated: User = await response.json();
      onUpdated(updated, action === 'updateDetails');
      if (action === 'updateDetails') {
        setName(updated.name);
        setCredit(updated.profile?.credit ?? '');
        setBio(updated.profile?.bio ?? '');
        setPhoto(updated.profile?.photo ?? '');
        setPhotoAssetId(updated.profile?.photoAssetId);
      } else {
        form.reset();
      }
      notify(action === 'updateDetails' ? 'Profile updated.' : 'Password changed.');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Your changes could not be saved.';
      setFeedback({ action, text });
    } finally {
      setSaving(null);
    }
  }

  function status(action: ProfileAction) {
    if (feedback?.action !== action) return null;
    return <p className="form-error" role="alert">{feedback.text}</p>;
  }

  return <dialog ref={dialog} className="panel studio-profile-dialog account-profile-dialog"
    aria-labelledby="studio-profile-title" onClose={onClose}
    onCancel={event => { if (busy) event.preventDefault(); }}>
    <div className="stack">
      <div className="panel-heading">
        <h2 className="serif" id="studio-profile-title">Profile</h2>
        <button type="button" className="studio-icon-button" aria-label="Close profile" disabled={busy}
          onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button>
      </div>
      <div className="studio-profile-columns">
        <form className="stack" onSubmit={event => save(event, 'updateDetails')}>
          <fieldset className="stack" disabled={busy}>
            <legend className="serif profile-section-title">Personal details</legend>
            <div className="profile-name-credit">
              <label>Name<input className="field" name="name" autoComplete="name" value={name}
                onChange={event => setName(event.target.value)} required maxLength={200} /></label>
              <label>Credit<input className="field" name="credit" value={credit}
                onChange={event => setCredit(event.target.value)} maxLength={200} /></label>
            </div>
            <label>Bio<textarea className="field" name="bio" value={bio}
              onChange={event => setBio(event.target.value)} rows={3} maxLength={2000} /></label>
            {photoSource && <div className="button-row profile-photo">
              <img src={photoSource} alt="Profile photo preview" />
              <button type="button" className="btn" onClick={() => {
                setPhoto('');
                setPhotoAssetId(undefined);
              }}>Remove photo</button>
            </div>}
            {!photoAssetId && <label>Photo URL<input className="field" name="photo" value={photo} type="url"
              maxLength={2048} onChange={event => setPhoto(event.target.value)} /></label>}
            {uploadsEnabled && <MediaUpload purpose="profile" busy={busy} onBusyChange={setUploading} onUploaded={asset => {
              setPhoto('');
              setPhotoAssetId(asset.id);
            }} />}
            <div><button className="btn primary" type="submit" disabled={!name.trim() || !dirty}>
              {saving === 'updateDetails' ? 'Saving…' : 'Save profile'}
            </button></div>
          </fieldset>
          {status('updateDetails')}
        </form>
        <form className="stack studio-profile-password" onSubmit={event => save(event, 'changePassword')}>
          <fieldset className="stack" disabled={busy}>
            <legend className="serif profile-section-title">Change password</legend>
            <label>Current password<input className="field" type="password" name="currentPassword"
              autoComplete="current-password" required maxLength={128} /></label>
            <label>New password<input className="field" type="password" name="newPassword"
              autoComplete="new-password" required minLength={minimumPasswordLength} maxLength={128}
              aria-describedby="studio-password-length" /></label>
            <p id="studio-password-length" className="muted text-sm">Use at least {minimumPasswordLength} characters.</p>
            <label>Confirm new password<input className="field" type="password" name="confirmPassword"
              autoComplete="new-password" required minLength={minimumPasswordLength} maxLength={128} /></label>
            <div><button className="btn primary" type="submit">{saving === 'changePassword' ? 'Saving…' : 'Change password'}</button></div>
          </fieldset>
          {status('changePassword')}
        </form>
      </div>
    </div>
  </dialog>;
}
