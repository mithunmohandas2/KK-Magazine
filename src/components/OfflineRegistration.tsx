"use client";

import { useEffect } from "react";

export default function OfflineRegistration() {
  useEffect(() => {
    if (!window.isSecureContext || !("serviceWorker" in navigator)) return;
    const register = () =>
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Reader navigation remains available if the browser blocks registration.
      });
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
