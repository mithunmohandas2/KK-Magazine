'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export type ImagePreview = { src: string; description: string; kind?: 'image' | 'video' };

export default function FullScreenImage({ image, onClose }: { image: ImagePreview; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="full-screen-image"
      aria-label={image.description}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.close();
      }}
      onClose={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <button
        type="button"
        className="studio-icon-button"
        aria-label="Close full-screen preview"
        onClick={() => dialog.current?.close()}
      >
        <X size={22} aria-hidden="true" />
      </button>
      {image.kind === 'video'
        ? <video src={image.src} controls aria-label={image.description} />
        : <img src={image.src} alt={image.description} />}
    </dialog>
  );
}
