"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Download,
  LogIn,
  Mail,
  Moon,
  Share2,
  Sun,
  X,
} from "lucide-react";
import type { ReaderMagazine, ReaderPageSummary } from "@/lib/data";
import type { InstallMethod } from "./useAppInstall";
import { useSuccessToast } from "./ToastProvider";
import ResponsiveImage from "./ResponsiveImage";

export type PanelView = "contents" | "menu" | "share" | "contact" | "install";
export type Theme = "light" | "dark";

const labels: Record<PanelView, string> = {
  contents: "Contents",
  menu: "Reader options",
  share: "Share",
  contact: "Contact us",
  install: "Install app",
};

function SharePanel({
  magazine,
  page,
}: {
  magazine: ReaderMagazine;
  page: ReaderPageSummary;
}) {
  const [wholeMagazine, setWholeMagazine] = useState(false);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const publication = new URL(window.location.pathname, window.location.origin);
  const link = new URL(publication);
  if (!wholeMagazine)
    link.hash = new URLSearchParams({ page: page.id }).toString();
  const title = wholeMagazine
    ? magazine.title
    : `${page.title} · ${magazine.title}`;
  const image = wholeMagazine ? magazine.pages[0]?.thumbnail : page.thumbnail;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link.href);
      setNotice("Link copied.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setNotice("The link is selected. Copy it from the field.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title, url: link.href });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        await copy();
    }
  }

  return (
    <div className="reader-panel-stack">
      <fieldset className="reader-share-scope">
        <legend className="sr-only">What to share</legend>
        <label>
          <input
            name="share-scope"
            type="radio"
            checked={!wholeMagazine}
            onChange={() => {
              setWholeMagazine(false);
              setNotice("");
            }}
          />{" "}
          This page
        </label>
        <label>
          <input
            name="share-scope"
            type="radio"
            checked={wholeMagazine}
            onChange={() => {
              setWholeMagazine(true);
              setNotice("");
            }}
          />{" "}
          The whole magazine
        </label>
      </fieldset>
      <div className="reader-share-preview">
        {image && (
          <ResponsiveImage
            src={image}
            alt=""
            sizes="(max-width: 480px) 90vw, 400px"
          />
        )}
        <strong>
          {!wholeMagazine && `${page.title} · `}
          <span className="magazine-name" lang="ml">
            {magazine.title}
          </span>
        </strong>
      </div>
      <label>
        Share link
        <input
          className="field"
          ref={input}
          value={link.href}
          readOnly
          onFocus={(event) => event.target.select()}
        />
      </label>
      <div className="button-row">
        {typeof navigator.share === "function" && (
          <button className="btn primary" type="button" onClick={share}>
            <Share2 size={16} /> Share link
          </button>
        )}
        <button className="btn" type="button" onClick={copy}>
          <Copy size={16} /> Copy link
        </button>
        <a
          className="btn"
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(link.href)}`}
        >
          <Mail size={16} /> Email
        </a>
      </div>
      {notice && (
        <p className="form-success" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

function ContactPanel() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const notify = useSuccessToast();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-KK-Request": "1" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(
          detail?.error || "Your message could not be sent. Try again.",
        );
      }
      setSent(true);
      notify("Message sent.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Your message could not be sent. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <p>Your message was sent to the magazine team.</p>;

  return (
    <form className="reader-panel-stack" onSubmit={submit}>
      <p className="reader-panel-description">
        Send a question or feedback to the magazine team.
      </p>
      <label>
        Name
        <input
          className="field"
          name="name"
          autoComplete="name"
          maxLength={100}
          required
        />
      </label>
      <label>
        Email
        <input
          className="field"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
        />
      </label>
      <label>
        Message
        <textarea
          className="field"
          name="message"
          rows={5}
          maxLength={3000}
          required
        />
      </label>
      <div hidden>
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div>
        <button className="btn primary" disabled={busy}>
          {busy ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}

export default function ReaderPanel({
  view,
  onChange,
  magazine,
  page,
  index,
  onSelect,
  theme,
  onThemeChange,
  staffUrl,
  staffLabel,
  installMethod,
  onInstall,
}: {
  view: PanelView | null;
  onChange: (value: PanelView | null) => void;
  magazine: ReaderMagazine;
  page?: ReaderPageSummary;
  index: number;
  onSelect: (index: number) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  staffUrl: string;
  staffLabel: string;
  installMethod: InstallMethod | null;
  onInstall: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!view) {
      if (element.open) element.close();
      return;
    }
    if (!element.open) element.showModal();
    element.scrollTop = 0;
    title.current?.focus();
  }, [view]);

  return (
    <dialog
      id="reader-panel"
      ref={dialog}
      className="reader-panel"
      data-view={view || undefined}
      aria-labelledby="reader-panel-title"
      onCancel={(event) => {
        event.preventDefault();
        onChange(null);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onChange(null);
      }}
    >
      {view && (
        <section className="reader-panel-inner">
          <div className="reader-panel-top">
            {(view === "contact" || view === "share" || view === "install") && (
              <button
                type="button"
                className="reader-panel-icon reader-panel-back"
                aria-label="Back to reader options"
                onClick={() => onChange("menu")}
              >
                <ArrowLeft size={21} />
              </button>
            )}
            <button
              type="button"
              className="reader-panel-icon reader-panel-close"
              aria-label={`Close ${labels[view].toLowerCase()}`}
              onClick={() => onChange(null)}
            >
              <X size={23} />
            </button>
          </div>
          <h2
            id="reader-panel-title"
            className="reader-panel-title"
            tabIndex={-1}
            ref={title}
          >
            {labels[view]}
          </h2>
          {view === "contents" && (
            <>
              <p className="reader-panel-description magazine-name" lang="ml">
                {magazine.title}
              </p>
              <ol className="reader-contents-list">
                {magazine.pages.map((item, position) => {
                  const thumbnail = item.thumbnail;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="reader-contents-row"
                        aria-current={position === index ? "page" : undefined}
                        onClick={() => onSelect(position)}
                      >
                        <span
                          className="reader-contents-thumbnail"
                          aria-hidden="true"
                        >
                          <BookOpen size={21} />
                          {thumbnail && (
                            <ResponsiveImage
                              src={thumbnail}
                              alt=""
                              fill
                              sizes="(max-width: 480px) 27vw, 144px"
                              onError={(event) => {
                                event.currentTarget.hidden = true;
                              }}
                            />
                          )}
                        </span>
                        <span className="reader-contents-title">
                          <span className="reader-contents-number">
                            Page {position + 1}
                          </span>
                          {item.title}
                        </span>
                        {position === index ? (
                          <Check size={18} aria-hidden="true" />
                        ) : (
                          <ChevronRight size={18} aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
          {view === "menu" && (
            <div className="reader-panel-stack">
              <div className="reader-action-list">
                {page && (
                  <button type="button" onClick={() => onChange("share")}>
                    <Share2 size={20} /> Share <ChevronRight size={16} />
                  </button>
                )}
                <button type="button" onClick={() => onChange("contact")}>
                  <Mail size={20} /> Contact us <ChevronRight size={16} />
                </button>
                {installMethod && (
                  <button type="button" onClick={onInstall}>
                    <Download size={20} aria-hidden="true" /> Install app
                    {installMethod === "prompt" ? (
                      <ArrowUpRight size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                )}
                <Link href={staffUrl} prefetch={false}>
                  <LogIn size={20} /> {staffLabel} <ArrowUpRight size={16} />
                </Link>
              </div>
              <fieldset className="reader-appearance">
                <legend>Appearance</legend>
                <div>
                  <label>
                    <input
                      type="radio"
                      name="reader-theme"
                      checked={theme === "light"}
                      onChange={() => onThemeChange("light")}
                    />
                    <Sun size={18} aria-hidden="true" /> Light
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="reader-theme"
                      checked={theme === "dark"}
                      onChange={() => onThemeChange("dark")}
                    />
                    <Moon size={18} aria-hidden="true" /> Dark
                  </label>
                </div>
              </fieldset>
            </div>
          )}
          {view === "share" && page && (
            <SharePanel magazine={magazine} page={page} />
          )}
          {view === "contact" && <ContactPanel />}
          {view === "install" && installMethod === "ios" && (
            <ol className="reader-install-steps">
              <li>
                Open this magazine in Safari and tap <strong>Share</strong>.
              </li>
              <li>
                Choose <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Turn on <strong>Open as Web App</strong> if offered, then tap{" "}
                <strong>Add</strong>.
              </li>
            </ol>
          )}
          {view === "install" && installMethod === "safari" && (
            <ol className="reader-install-steps">
              <li>
                In Safari on macOS Sonoma or later, choose{" "}
                <strong>File → Add to Dock</strong>.
              </li>
              <li>
                Choose <strong>Add</strong> to save the app to your Dock.
              </li>
            </ol>
          )}
        </section>
      )}
    </dialog>
  );
}
