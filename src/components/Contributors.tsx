"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Maximize2, Pencil, X } from "lucide-react";
import {
  mediaUrl,
  minimumPasswordLength,
  type Author,
  type User,
} from "@/lib/data";
import MediaUpload from "./MediaUpload";
import FullScreenImage, { type ImagePreview } from "./FullScreenImage";
import ResponsiveImage from "./ResponsiveImage";

type SaveContributor = (
  id: string,
  author: Omit<Author, "id" | "accountId">,
  accountId: string | null,
  newPassword?: string,
) => Promise<boolean>;

function ContributorForm({
  author,
  accounts,
  busy,
  uploadsEnabled,
  error,
  onBusyChange,
  onSave,
  onClose,
  onPreview,
}: {
  author?: Author;
  accounts?: User[];
  busy: boolean;
  uploadsEnabled: boolean;
  error: string;
  onBusyChange: (busy: boolean) => void;
  onSave: SaveContributor;
  onClose: () => void;
  onPreview: (photo: ImagePreview) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [contributorId] = useState(() => author?.id ?? crypto.randomUUID());
  const [photoId, setPhotoId] = useState(author?.photoAssetId);
  const [photoUrl, setPhotoUrl] = useState(author?.photo ?? "");
  const [accountId, setAccountId] = useState(author?.accountId ?? "");
  const [email, setEmail] = useState(
    accounts?.find((account) => account.id === accountId)?.email ??
      author?.email ??
      "",
  );
  const [resetPassword, setResetPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const photoSource = photoId
    ? mediaUrl(photoId)
    : /^https?:\/\//i.test(photoUrl)
      ? photoUrl
      : "";
  const title = author ? "Edit contributor" : "Add contributor";

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const newPassword = resetPassword
      ? String(fields.get("newPassword") ?? "")
      : undefined;
    if (
      newPassword !== undefined &&
      newPassword !== fields.get("confirmPassword")
    ) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    setPasswordError("");
    const saved = await onSave(
      contributorId,
      {
        name: String(fields.get("name")),
        role: String(fields.get("role")),
        bio: String(fields.get("bio")),
        photo: photoId ? "" : photoUrl.trim(),
        photoAssetId: photoId,
        email: accounts ? email.trim() : undefined,
      },
      accountId || null,
      newPassword,
    );
    if (saved) dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      className="panel studio-profile-dialog contributor-form-dialog"
      aria-labelledby="contributor-form-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <form className="form-grid" onSubmit={save}>
        <div className="form-wide panel-heading">
          <h2 className="serif" id="contributor-form-title">
            {title}
          </h2>
          <button
            type="button"
            className="studio-icon-button"
            disabled={busy}
            aria-label="Close contributor form"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <label>
          Name
          <input
            name="name"
            className="field"
            defaultValue={author?.name}
            required
            maxLength={200}
            disabled={busy}
          />
        </label>
        <label>
          Credit
          <input
            name="role"
            className="field"
            defaultValue={author?.role}
            maxLength={200}
            disabled={busy}
          />
        </label>
        {accounts && (
          <label>
            Email
            <input
              name="email"
              className="field"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={254}
              required={Boolean(accountId)}
              disabled={busy}
            />
          </label>
        )}
        {author && accounts && (
          <label>
            Linked login
            <select
              className="field"
              value={accountId}
              disabled={busy}
              onChange={(event) => {
                const account = accounts.find(
                  (account) => account.id === event.target.value,
                );
                setAccountId(account?.id ?? "");
                if (account) setEmail(account.email);
                setResetPassword(false);
                setPasswordError("");
              }}
            >
              <option value="">No login linked</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.email})
                </option>
              ))}
            </select>
          </label>
        )}
        {accountId && (
          <p className="form-wide muted text-sm">
            Name and email changes also update the linked login.
          </p>
        )}
        <fieldset className="stack contributor-photo-fields" disabled={busy}>
          <legend>Contributor photo</legend>
          {!photoId && (
            <label>
              Photo URL
              <input
                className="field"
                type="url"
                maxLength={2048}
                value={photoUrl}
                onChange={(event) => setPhotoUrl(event.target.value)}
              />
            </label>
          )}
          {photoSource && (
            <>
              <ResponsiveImage
                className="contributor-photo-preview"
                src={photoSource}
                alt="Selected contributor photo"
                sizes="192px"
              />
              <div className="button-row">
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    onPreview({
                      src: photoSource,
                      description: "Selected contributor photo",
                    })
                  }
                >
                  <Maximize2 size={16} aria-hidden="true" /> Full-screen preview
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setPhotoId(undefined);
                    setPhotoUrl("");
                  }}
                >
                  Remove photo
                </button>
              </div>
            </>
          )}
          {uploadsEnabled && (
            <MediaUpload
              purpose="contributor"
              contributorId={contributorId}
              busy={busy}
              onBusyChange={onBusyChange}
              onUploaded={(asset) => {
                setPhotoId(asset.id);
                setPhotoUrl("");
              }}
            />
          )}
        </fieldset>
        <label className="contributor-bio">
          Bio
          <textarea
            name="bio"
            className="field"
            defaultValue={author?.bio}
            rows={5}
            maxLength={2000}
            disabled={busy}
          />
        </label>
        {accountId && (
          <fieldset className="form-wide stack" disabled={busy}>
            <label className="check-label">
              <input
                type="checkbox"
                checked={resetPassword}
                onChange={(event) => {
                  setResetPassword(event.target.checked);
                  setPasswordError("");
                }}
              />{" "}
              Reset password
            </label>
            {resetPassword && (
              <div className="form-grid">
                <p className="form-wide muted text-sm">
                  Use at least {minimumPasswordLength} characters. Resetting the
                  password signs the contributor out of other sessions.
                </p>
                <label>
                  New password
                  <input
                    name="newPassword"
                    className="field"
                    type="password"
                    required
                    minLength={minimumPasswordLength}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
                <label>
                  Confirm new password
                  <input
                    name="confirmPassword"
                    className="field"
                    type="password"
                    required
                    minLength={minimumPasswordLength}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
              </div>
            )}
          </fieldset>
        )}
        {(passwordError || error) && (
          <p className="form-wide form-error" role="alert">
            {passwordError || error}
          </p>
        )}
        <div className="form-wide button-row studio-delete-actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {author ? "Save changes" : "Add contributor"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export default function Contributors({
  authors,
  form,
  accounts,
  busy,
  uploadsEnabled,
  error,
  onBusyChange,
  onEdit,
  onSave,
  onClose,
}: {
  authors: Author[];
  form: Author | "new" | null;
  accounts?: User[];
  busy: boolean;
  uploadsEnabled: boolean;
  error: string;
  onBusyChange: (busy: boolean) => void;
  onEdit: (author: Author) => void;
  onSave: SaveContributor;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<ImagePreview | null>(null);
  const author = form && form !== "new" ? form : undefined;
  const linkedToOthers = new Set(
    authors
      .filter((item) => item.id !== author?.id)
      .map((item) => item.accountId),
  );
  return (
    <>
      <div className="panel record-list">
        {authors.map((author) => {
          const src = author.photoAssetId
            ? mediaUrl(author.photoAssetId)
            : author.photo;
          const description = `Photo of ${author.name}`;
          return (
            <div className="record contributor-record" key={author.id}>
              <div className="contributor">
                {src && (
                  <button
                    type="button"
                    className="contributor-photo-button"
                    aria-label={`View photo of ${author.name} full-screen`}
                    onClick={() => setPreview({ src, description })}
                  >
                    <ResponsiveImage src={src} alt="" sizes="48px" />
                  </button>
                )}
                <div>
                  <strong>{author.name}</strong>
                  <div className="muted">{author.role}</div>
                  {accounts && author.email && (
                    <div className="muted">{author.email}</div>
                  )}
                  {author.bio && (
                    <div className="muted contributor-bio-text">
                      {author.bio}
                    </div>
                  )}
                </div>
              </div>
              {accounts && (
                <button
                  type="button"
                  className="btn"
                  aria-label={`Edit contributor ${author.name}`}
                  aria-haspopup="dialog"
                  disabled={busy}
                  onClick={() => onEdit(author)}
                >
                  <Pencil size={15} aria-hidden="true" /> Edit
                </button>
              )}
            </div>
          );
        })}
        {!authors.length && (
          <p className="empty-state">No contributors added.</p>
        )}
      </div>
      {form && (
        <ContributorForm
          key={author?.id ?? "new"}
          author={author}
          accounts={accounts?.filter(
            (account) => !linkedToOthers.has(account.id),
          )}
          busy={busy}
          uploadsEnabled={uploadsEnabled}
          error={error}
          onBusyChange={onBusyChange}
          onSave={onSave}
          onClose={onClose}
          onPreview={setPreview}
        />
      )}
      {preview && (
        <FullScreenImage image={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
