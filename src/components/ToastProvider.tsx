'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';

const SuccessToast = createContext<(message: string) => void>(() => {});

export function useSuccessToast() {
  return useContext(SuccessToast);
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const notify = useCallback((message: string) => setToast(current => ({
    id: (current?.id ?? 0) + 1, message,
  })), []);

  useEffect(() => {
    if (!toast) return;

    function updateHost() {
      // Native modal dialogs render above the rest of the document.
      const dialogs = document.querySelectorAll<HTMLElement>('dialog:modal');
      setHost(dialogs[dialogs.length - 1] ?? document.body);
    }

    updateHost();
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    const timeout = window.setTimeout(() => setToast(null), 5000);
    return () => {
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, [toast]);

  return <SuccessToast.Provider value={notify}>
    {children}
    {host && createPortal(
      <div className="toast-viewport" role="status">
        {toast && <div key={toast.id} className="success-toast">
          <CheckCircle2 size={19} aria-hidden="true" />
          <span>{toast.message}</span>
        </div>}
      </div>, host,
    )}
  </SuccessToast.Provider>;
}
