"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Maximize2, Pencil, Trash2, X } from "lucide-react";
import {
  contributorName,
  mediaUrl,
  minimumPasswordLength,
  type Author,
  type User,
  type Workspace,
} from "@/lib/data";
import MediaUpload from "./MediaUpload";
import FullScreenImage, { type ImagePreview } from "./FullScreenImage";
import PersonAvatar from "./PersonAvatar";
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
  const [formError, setFormError] = useState("");
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
    const name = String(fields.get("name") ?? "").trim();
    const nameMalayalam = String(fields.get("nameMalayalam") ?? "").trim();
    if (!name && !nameMalayalam) {
      setFormError("Enter a name in English or Malayalam.");
      return;
    }
    const newPassword = resetPassword
      ? String(fields.get("newPassword") ?? "")
      : undefined;
    if (
      newPassword !== undefined &&
      newPassword !== fields.get("confirmPassword")
    ) {
      setFormError("The new passwords do not match.");
      return;
    }
    setFormError("");
    const saved = await onSave(
      contributorId,
      {
        name,
        nameMalayalam,
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
          Name in English
          <input
            name="name"
            className="field"
            defaultValue={author?.name}
            maxLength={200}
            disabled={busy}
          />
        </label>
        <label>
          Name in Malayalam
          <input
            name="nameMalayalam"
            className="field"
            lang="ml"
            defaultValue={author?.nameMalayalam}
            maxLength={200}
            disabled={busy}
          />
        </label>
        <label className={accounts ? undefined : "form-wide"}>
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
        <div className="form-wide form-grid">
          <div className="stack contributor-detail-fields">
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
                    setFormError("");
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
              <p className="muted text-sm">
                Name and email changes also update the linked login.
              </p>
            )}
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
          </div>
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
        </div>
        {accountId && (
          <fieldset className="form-wide stack" disabled={busy}>
            <label className="check-label">
              <input
                type="checkbox"
                checked={resetPassword}
                onChange={(event) => {
                  setResetPassword(event.target.checked);
                  setFormError("");
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
        {(formError || error) && (
          <p className="form-wide form-error" role="alert">
            {formError || error}
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
  search,
  form,
  accounts,
  busy,
  uploadsEnabled,
  error,
  onBusyChange,
  onEdit,
  onDelete,
  onSave,
  onClose,
}: {
  authors: Workspace["authors"];
  search: string;
  form: Author | "new" | null;
  accounts?: User[];
  busy: boolean;
  uploadsEnabled: boolean;
  error: string;
  onBusyChange: (busy: boolean) => void;
  onEdit: (author: Author) => void;
  onDelete: (author: Author) => void;
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
  const visibleAuthors = search
    ? authors.filter(({ name, nameMalayalam, role, email }) =>
        [name, nameMalayalam, role, accounts ? email : undefined].some((value) =>
          value?.normalize().toLowerCase().includes(search),
        ),
      )
    : authors;
  return (
    <>
      <div className="panel record-list">
        {visibleAuthors.map((author) => {
          const src = author.photoAssetId
            ? mediaUrl(author.photoAssetId)
            : author.photo;
          const name = contributorName(author);
          const description = `Photo of ${name}`;
          return (
            <div className="record contributor-record" key={author.id}>
              <div className="person-summary">
                <PersonAvatar
                  name={name}
                  src={author.photoThumbnail || src}
                  onPreview={
                    src ? () => setPreview({ src, description }) : undefined
                  }
                />
                <div>
                  <strong>{name}</strong>
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
                <div className="button-row">
                  <button
                    type="button"
                    className="btn icon-button"
                    title="Edit"
                    aria-label={`Edit contributor ${name}`}
                    aria-haspopup="dialog"
                    disabled={busy}
                    onClick={() => onEdit(author)}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="btn icon-button delete-action"
                    title="Delete"
                    aria-label={`Delete contributor ${name}`}
                    aria-haspopup="dialog"
                    disabled={busy}
                    onClick={() => onDelete(author)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!visibleAuthors.length && (
          <p className="empty-state" role="status">
            {search ? "No contributors match your search." : "No contributors added."}
          </p>
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
