"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2 } from "lucide-react";
import FullScreenImage from "./FullScreenImage";

export default function ImageMaximize({
  src,
  description,
  className = "content-image-maximize",
  children,
}: {
  src: string;
  description: string;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        title="Fullscreen"
        aria-label={`View ${description} fullscreen`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {children ?? <Maximize2 size={17} aria-hidden="true" />}
      </button>
      {open &&
        createPortal(
          <FullScreenImage
            image={{ src, description }}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}
