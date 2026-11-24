"use client";

import { useEffect, useRef, useState } from "react";

export default function YouTubePlayer({
  videoId,
  title,
  autoplay,
}: {
  videoId: string;
  title: string;
  autoplay: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!autoplay || !frame.current) return;
    const threshold = 0.51;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio < threshold) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold },
    );
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [autoplay]);

  const playback = autoplay ? "&autoplay=1&mute=1" : "";
  return (
    <>
      <div className="youtube-player" ref={frame}>
        {(!autoplay || visible) && (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?playsinline=1${playback}`}
            title={title}
            loading={autoplay ? "eager" : "lazy"}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
    </>
  );
}
