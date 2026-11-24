"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Trash2 } from "lucide-react";
import { mediaUrl, type MediaAsset } from "@/lib/data";
import FullScreenImage, { type ImagePreview } from "./FullScreenImage";
import MediaUpload from "./MediaUpload";
import ResponsiveImage from "./ResponsiveImage";
import { useSuccessToast } from "./ToastProvider";

function externalImageName(url: string) {
  try {
    const filename = new URL(url).pathname.split("/").pop();
    if (filename) return decodeURIComponent(filename);
  } catch {
    // A malformed URL has no usable filename.
  }
  return "Magazine image";
}

function MediaCard({
  image,
  onPreview,
  onDelete,
  busy,
}: {
  image: ImagePreview;
  onPreview: () => void;
  onDelete?: () => void;
  busy: boolean;
}) {
  return (
    <div className="panel media-card">
      <div className="media-thumbnail">
        {image.kind === "video" ? (
          <video
            src={image.src}
            controls
            preload="none"
            aria-label={image.description}
          />
        ) : (
          <ResponsiveImage
            src={image.src}
            alt=""
            fill
            sizes="(max-width: 440px) 85vw, (max-width: 800px) 42vw, 250px"
          />
        )}
        <button
          type="button"
          className="btn media-maximize"
          title="Fullscreen"
          aria-label={`Preview ${image.description} full-screen`}
          aria-haspopup="dialog"
          disabled={busy}
          onClick={onPreview}
        >
          <Maximize2 size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="media-card-details">
        <span className="asset-name" title={image.description}>
          {image.description}
        </span>
        {onDelete && (
          <button
            type="button"
            className="btn delete-action media-delete"
            title="Delete image"
            aria-label={`Delete ${image.description}`}
            aria-haspopup="dialog"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 size={17} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function MediaLibrary({
  assets,
  imageUrls,
  canEdit,
  canDelete,
  enabled,
  busy,
  onBusyChange,
  onUploaded,
  onDeleted,
}: {
  assets: MediaAsset[];
  imageUrls: string[];
  canEdit: boolean;
  canDelete: boolean;
  enabled: boolean;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onUploaded: (asset: MediaAsset) => void;
  onDeleted: (id: string) => void;
}) {
  const [preview, setPreview] = useState<ImagePreview | null>(null);
  const [candidate, setCandidate] = useState<MediaAsset | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const notify = useSuccessToast();

  useEffect(() => {
    if (candidate && !dialog.current?.open) dialog.current?.showModal();
  }, [candidate]);

  async function confirmDelete() {
    if (!candidate || busy) return;
    setError("");
    onBusyChange(true);
    try {
      const response = await fetch(mediaUrl(candidate.id), {
        method: "DELETE",
        headers: { "X-KK-Request": "1" },
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error || "The image could not be deleted.");
      }
      dialog.current?.close();
      onDeleted(candidate.id);
      notify("Image deleted.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The image could not be deleted.",
      );
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <div className="stack">
      {canEdit && enabled && (
        <MediaUpload
          busy={busy}
          onBusyChange={onBusyChange}
          onUploaded={onUploaded}
        />
      )}
      {canEdit && !enabled && (
        <p className="muted text-sm">
          Cloudinary uploads are unavailable. You can still use image and video
          URLs in a page.
        </p>
      )}
      <div className="media-grid">
        {assets.map((asset) => {
          const image = {
            src: mediaUrl(asset.id),
            description: asset.name,
            kind: asset.kind,
          };
          return (
            <MediaCard
              key={asset.id}
              image={image}
              busy={busy}
              onPreview={() => setPreview(image)}
              onDelete={
                canDelete && asset.kind === "image"
                  ? () => {
                      setError("");
                      setCandidate(asset);
                    }
                  : undefined
              }
            />
          );
        })}
        {imageUrls.map((url) => {
          const image = { src: url, description: externalImageName(url) };
          return (
            <MediaCard
              key={url}
              image={image}
              busy={busy}
              onPreview={() => setPreview(image)}
            />
          );
        })}
      </div>
      {preview && (
        <FullScreenImage image={preview} onClose={() => setPreview(null)} />
      )}
      {candidate && (
        <dialog
          ref={dialog}
          className="studio-delete-dialog panel"
          aria-labelledby="delete-image-title"
          aria-describedby="delete-image-description"
          onClose={() => setCandidate(null)}
          onCancel={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <div className="stack">
            <h2 id="delete-image-title" className="serif">
              Delete image?
            </h2>
            <p id="delete-image-description">
              Permanently delete <strong>{candidate.name}</strong> from
              Cloudinary and the Media Library?
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="button-row studio-delete-actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => dialog.current?.close()}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={busy}
                onClick={confirmDelete}
              >
                {busy ? "Deleting…" : "Delete image"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
