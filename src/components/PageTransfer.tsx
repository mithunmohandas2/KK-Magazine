"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { WorkspaceCommand } from "@/lib/commands";
import type { PageContent } from "@/lib/data";
import {
  maxPageExportBytes,
  pageContent,
  pageExportFormat,
  pageExportVersion,
} from "@/lib/page-transfer";

type ImportPages = Extract<WorkspaceCommand, { action: "importPages" }>;

export default function PageTransfer({
  pages,
  single,
  busy,
  send,
}: {
  pages: PageContent[];
  single?: boolean;
  busy: boolean;
  send: (command: ImportPages, success: string) => Promise<unknown>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function run(operation: () => Promise<void>) {
    if (busy || working) return;
    setWorking(true);
    setError("");
    try {
      await operation();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Page transfer failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function exportPages() {
    const { pageTransferFile } = await import("@/lib/commands");
    const data = pageTransferFile.safeParse({
      format: pageExportFormat,
      version: pageExportVersion,
      pages: pages.map(pageContent),
    });
    if (!data.success) {
      throw new Error(
        single
          ? "Complete the page title and fix invalid fields before exporting."
          : "Unable to export all pages together. Export individual pages instead.",
      );
    }
    const file = new Blob([JSON.stringify(data.data)], {
      type: "application/json",
    });
    if (file.size > maxPageExportBytes) {
      throw new Error(
        single
          ? "This page exceeds the 3 MB transfer limit."
          : "These pages exceed the 3 MB transfer limit. Export individual pages instead.",
      );
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    const filename = single
      ? pages[0].title
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 80)
      : "magazine-pages";
    link.href = url;
    link.download = `${filename || "magazine-page"}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importPages(file: File) {
    if (file.size > maxPageExportBytes)
      throw new Error("Choose a magazine export file up to 3 MB.");
    const { pageTransferFile } = await import("@/lib/commands");
    let value: unknown;
    try {
      value = JSON.parse(await file.text());
    } catch {
      throw new Error("Choose a valid magazine JSON export.");
    }
    const parsed = pageTransferFile.safeParse(value);
    if (!parsed.success)
      throw new Error("This file is not a supported magazine page export.");
    const count = parsed.data.pages.length;
    await send(
      { action: "importPages", file: parsed.data },
      count === 1
        ? "Page imported as a new draft."
        : `${count} pages imported as new drafts.`,
    );
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void run(() => importPages(file));
        }}
      />
      <button
        type="button"
        className="btn"
        title="Import pages as new drafts"
        disabled={busy || working}
        onClick={() => input.current?.click()}
      >
        <Upload size={16} aria-hidden="true" /> Import
      </button>
      <button
        type="button"
        className="btn"
        disabled={busy || working || !pages.length}
        onClick={() => run(exportPages)}
      >
        <Download size={16} aria-hidden="true" />{" "}
        {single ? "Export" : "Export all"}
      </button>
      {error && (
        <p className="form-error page-transfer-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
