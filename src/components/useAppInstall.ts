'use client';

import { useEffect, useRef, useState } from 'react';

export type InstallMethod = 'prompt' | 'ios' | 'safari';

type BrowserInstallEvent = Event & {
  prompt: () => Promise<unknown>;
};

const installedKey = 'mozhi-app-installed';

function safariInstallMethod(): InstallMethod | null {
  const { userAgent, maxTouchPoints } = navigator;
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  if (/Macintosh/.test(userAgent) && /Safari\//.test(userAgent) && !/Chrome|Chromium|Edg|OPR/.test(userAgent)) {
    const safariVersion = Number(userAgent.match(/Version\/(\d+)/)?.[1]);
    if (safariVersion >= 17) return 'safari';
  }
  return null;
}

function rememberInstallation(installed: boolean) {
  try {
    if (installed) localStorage.setItem(installedKey, 'true');
    else localStorage.removeItem(installedKey);
  } catch {
    // The browser can still install the app when storage is blocked.
  }
}

export function useAppInstall() {
  const [method, setMethod] = useState<InstallMethod | null>(null);
  const installPrompt = useRef<BrowserInstallEvent | null>(null);

  useEffect(() => {
    if (!window.isSecureContext) return;
    const installWindow = window as Window & { mozhiInstallPrompt?: BrowserInstallEvent };
    const displayMode = window.matchMedia('(display-mode: standalone), (display-mode: minimal-ui), (display-mode: window-controls-overlay)');
    const isStandalone = () => displayMode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

    function installed() {
      installPrompt.current = null;
      delete installWindow.mozhiInstallPrompt;
      rememberInstallation(true);
      setMethod(null);
    }

    function update() {
      if (isStandalone()) {
        installed();
        return;
      }
      try {
        if (localStorage.getItem(installedKey) === 'true') {
          installPrompt.current = null;
          setMethod(null);
          return;
        }
      } catch {
        // Fall back to browser availability when the installation marker cannot be read.
      }
      setMethod(installPrompt.current ? 'prompt' : safariInstallMethod());
    }

    function beforeInstall(event: Event) {
      event.preventDefault();
      delete installWindow.mozhiInstallPrompt;
      if (isStandalone()) return;
      // A new browser offer can make installation available again after an uninstall.
      rememberInstallation(false);
      installPrompt.current = event as BrowserInstallEvent;
      setMethod('prompt');
    }

    function onStorage(event: StorageEvent) {
      if (event.key === installedKey) update();
    }

    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    window.addEventListener('storage', onStorage);
    displayMode.addEventListener('change', update);
    if (installWindow.mozhiInstallPrompt) beforeInstall(installWindow.mozhiInstallPrompt);
    else update();
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('storage', onStorage);
      displayMode.removeEventListener('change', update);
    };
  }, []);

  async function promptInstall() {
    const prompt = installPrompt.current;
    if (!prompt) return;
    installPrompt.current = null;
    setMethod(null);
    try {
      await prompt.prompt();
    } catch {
      // The browser can offer a fresh prompt on a later visit.
    }
  }

  return { method, promptInstall };
}
