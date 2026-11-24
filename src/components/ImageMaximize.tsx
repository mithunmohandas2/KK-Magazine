"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2 } from "lucide-react";
import FullScreenImage from "./FullScreenImage";

export default function ImageMaximize({
  src,
  description,
}: {
  src: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="content-image-maximize"
        title="Fullscreen"
        aria-label={`View ${description} fullscreen`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Maximize2 size={17} aria-hidden="true" />
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
