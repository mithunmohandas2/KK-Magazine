"use client";

import { useState } from "react";
import { nameInitial } from "@/lib/data";
import ResponsiveImage from "./ResponsiveImage";

export default function PersonAvatar({
  name,
  src,
  onPreview,
}: {
  name: string;
  src?: string;
  onPreview?: () => void;
}) {
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const photo = src?.trim();
  const image =
    photo && photo !== failedPhoto ? (
      <ResponsiveImage
        src={photo}
        alt=""
        sizes="48px"
        onError={() => setFailedPhoto(photo)}
      />
    ) : null;

  if (image && onPreview) {
    return (
      <button
        type="button"
        className="studio-avatar directory-avatar contributor-photo-button"
        aria-label={`View photo of ${name} full-screen`}
        onClick={onPreview}
      >
        {image}
      </button>
    );
  }

  return (
    <span className="studio-avatar directory-avatar" aria-hidden="true">
      {image ?? nameInitial(name)}
    </span>
  );
}
