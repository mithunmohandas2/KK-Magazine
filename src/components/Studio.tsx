"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  FileText,
  Images,
  Mail,
  Maximize2,
  Menu,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  blockSource,
  initialMagazine,
  magazineCoverId,
  magazineName,
  minimumPasswordLength,
  permissions,
  roles,
  templates,
  type Author,
  type Block,
  type EditorialPage,
  type MediaAsset,
  type PageContent,
  type Role,
  type User,
  type Workspace,
} from "@/lib/data";
import type { Transition, WorkspaceCommand } from "@/lib/commands";
import MagazinePage from "./MagazinePage";
import FullScreenImage, { type ImagePreview } from "./FullScreenImage";
import MediaUpload from "./MediaUpload";
import PageList from "./PageList";
import StudioAccount from "./StudioAccount";
import { useSuccessToast } from "./ToastProvider";
import ResponsiveImage from "./ResponsiveImage";

const MediaLibrary = dynamic(() => import("./MediaLibrary"), {
  loading: () => <p role="status">Loading media library…</p>,
});
const Contributors = dynamic(() => import("./Contributors"), {
  loading: () => <p role="status">Loading contributors…</p>,
});
const ContactInbox = dynamic(() => import("./ContactInbox"), {
  loading: () => <p role="status">Loading reader messages…</p>,
});

type View =
  | "pages"
  | "reviews"
  | "publishing"
  | "authors"
  | "media"
  | "users"
  | "inbox";
type ImportCommand = Extract<WorkspaceCommand, { action: "importDrafts" }>;
type Send = (
  command: WorkspaceCommand,
  message: string,
) => Promise<Workspace | null>;

function pageContent({
  id,
  title,
  template,
  authors,
  blocks,
}: PageContent): PageContent {
  return { id, title, template, authors, blocks };
}

const blockLabels: Record<Block["type"], string> = {
  heading: "Heading",
  paragraph: "Text",
  image: "Image",
  video: "Video",
  quote: "Quote",
};

function NewUserForm({ send, busy }: { send: Send; busy: boolean }) {
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const result = await send(
      {
        action: "createUser",
        user: {
          name: String(fields.get("name")),
          email: String(fields.get("email")),
          password: String(fields.get("password")),
          role: fields.get("role") as Role,
        },
      },
      "Account created.",
    );
    if (result) form.reset();
  }

  return (
    <form className="panel form-grid" onSubmit={create}>
      <h2 className="form-wide serif">Create account</h2>
      <label>
        Name
        <input className="field" name="name" required maxLength={200} />
      </label>
      <label>
        Email
        <input
          className="field"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
        />
      </label>
      <label>
        Initial password
        <input
          className="field"
          name="password"
          type="password"
          required
          minLength={minimumPasswordLength}
          maxLength={128}
          autoComplete="new-password"
        />
      </label>
      <label>
        Role
        <select className="field" name="role" defaultValue="Editor">
          {roles.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
      </label>
      <div className="form-wide">
        <button className="btn primary" disabled={busy}>
          Create user
        </button>
      </div>
    </form>
  );
}

function PageEditor({
  page,
  isCover,
  authors,
  media,
  role,
  busy,
  send,
  uploadsEnabled,
  onBusyChange,
  onUploaded,
  onDelete,
}: {
  page: EditorialPage;
  isCover: boolean;
  authors: Author[];
  media: MediaAsset[];
  role: Role;
  busy: boolean;
  send: Send;
  uploadsEnabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onUploaded: (asset: MediaAsset) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(() => ({
    ...pageContent(page),
    template: isCover ? ("Cover" as const) : page.template,
  }));
  const [note, setNote] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<ImagePreview | null>(
    null,
  );
  const canEdit = permissions.editPage(role, isCover);
  const editable = page.status === "Draft" && canEdit;
  const dirty = JSON.stringify(draft) !== JSON.stringify(pageContent(page));

  function transition(step: Transition, message: string) {
    return send(
      { action: "transition", id: page.id, version: page.version, step, note },
      message,
    );
  }

  function updateBlock(id: string, update: Partial<Block>) {
    setDraft((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === id ? { ...block, ...update } : block,
      ),
    }));
  }

  function updateTitle(title: string) {
    setDraft((current) => {
      const heading =
        isCover &&
        current.blocks.find(
          (block) => block.type === "heading" && block.text.trim(),
        );
      return {
        ...current,
        title,
        blocks: heading
          ? current.blocks.map((block) =>
              block === heading ? { ...block, text: title } : block,
            )
          : current.blocks,
      };
    });
  }

  function moveBlock(index: number, offset: number) {
    const blocks = [...draft.blocks];
    [blocks[index], blocks[index + offset]] = [
      blocks[index + offset],
      blocks[index],
    ];
    setDraft({ ...draft, blocks });
  }

  function addBlock(type: Block["type"]) {
    const block = { id: crypto.randomUUID(), type, text: "" };
    setDraft({ ...draft, blocks: [...draft.blocks, block] });
    setActive(block.id);
  }

  function mediaFields(
    block: Pick<Block, "src" | "assetId">,
    kind: "image" | "video",
    update: (change: Partial<Block>) => void,
    urlLabel: string,
  ) {
    const assets = media.filter(
      (asset) => asset.kind === kind && !asset.deletion,
    );
    return (
      <>
        {(assets.length > 0 || block.assetId) && (
          <label>
            Media library
            <select
              className="field"
              value={block.assetId || ""}
              onChange={(event) => {
                const assetId = event.target.value || undefined;
                update({ assetId, src: assetId ? undefined : block.src });
              }}
            >
              <option value="">Use a URL</option>
              {block.assetId &&
                !assets.some((asset) => asset.id === block.assetId) && (
                  <option value={block.assetId}>Current {kind}</option>
                )}
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!block.assetId && (
          <label>
            {urlLabel}
            <input
              className="field"
              type="url"
              maxLength={2048}
              value={block.src || ""}
              onChange={(event) => update({ src: event.target.value })}
            />
          </label>
        )}
        {kind === "image" && uploadsEnabled && (
          <MediaUpload
            imageOnly
            busy={busy}
            onBusyChange={onBusyChange}
            onUploaded={(asset) => {
              onUploaded(asset);
              update({ assetId: asset.id, src: undefined });
            }}
          />
        )}
      </>
    );
  }

  function imagePreview(src: string | undefined, description: string) {
    if (!src || !/^(https?:\/\/|\/api\/media\/)/i.test(src)) return null;
    return (
      <div className="stack page-image-preview">
        <ResponsiveImage
          src={src}
          alt={description}
          sizes="(max-width: 750px) 90vw, 720px"
        />
        <div>
          <button
            type="button"
            className="btn"
            aria-haspopup="dialog"
            disabled={busy}
            onClick={() => setFullScreenImage({ src, description })}
          >
            <Maximize2 size={16} aria-hidden="true" /> Full-screen preview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="workspace-heading">
        <div>
          <h1>{page.title}</h1>
          <span className="pill">{page.status}</span>
        </div>
        <div className="button-row">
          {editable && (
            <button
              className="btn"
              disabled={busy}
              onClick={() => setPreview(!preview)}
            >
              {preview ? "Edit draft" : "Preview draft"}
            </button>
          )}
          {editable && (
            <button
              className="btn"
              disabled={busy || !dirty || !draft.title.trim()}
              onClick={() =>
                send(
                  { action: "savePage", page: draft, version: page.version },
                  "Draft saved.",
                )
              }
            >
              Save draft
            </button>
          )}
          {editable && (
            <button
              className="btn primary"
              disabled={busy || dirty}
              onClick={() => transition("submit", "Submitted for review.")}
            >
              Submit for review
            </button>
          )}
          {canEdit &&
            (isCover
              ? page.status !== "Draft"
              : page.status === "Published") && (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => transition("revise", "Draft revision created.")}
              >
                {isCover ? "Edit cover" : "Create revision"}
              </button>
            )}
          {page.status === "In review" && permissions.review(role) && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => transition("approve", "Page approved.")}
            >
              Approve
            </button>
          )}
          {page.status === "Approved" && permissions.publish(role) && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => transition("publish", "Page published.")}
            >
              Publish
            </button>
          )}
          {canEdit && !isCover && (
            <button
              type="button"
              className="btn delete-action"
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete page
            </button>
          )}
        </div>
      </div>
      {dirty && <p className="muted text-sm">Unsaved changes</p>}
      {page.reviewNote && (
        <div className="panel review-note">
          <strong>Review feedback</strong>
          <p>{page.reviewNote}</p>
        </div>
      )}
      {page.status === "In review" && permissions.review(role) && (
        <div className="panel stack">
          <label>
            Requested changes
            <textarea
              className="field"
              value={note}
              maxLength={2000}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div>
            <button
              className="btn"
              disabled={busy || !note.trim()}
              onClick={() => transition("return", "Returned for changes.")}
            >
              Request changes
            </button>
          </div>
        </div>
      )}
      {editable && !preview ? (
        <div className="edit-layout">
          <div className="panel stack">
            <div className="panel-heading">
              <h2 className="serif">Page content</h2>
              <div className="button-row">
                {(Object.keys(blockLabels) as Block["type"][]).map((type) => (
                  <button
                    className="btn"
                    key={type}
                    disabled={busy || draft.blocks.length >= 100}
                    onClick={() => addBlock(type)}
                  >
                    <Plus size={13} />
                    {blockLabels[type]}
                  </button>
                ))}
              </div>
            </div>
            <fieldset disabled={busy} className="stack">
              {draft.blocks.map((block, index) => (
                <div className="block-editor stack" key={block.id}>
                  <div className="panel-heading">
                    <label htmlFor={`block-${block.id}`}>
                      {blockLabels[block.type]}
                    </label>
                    <div className="button-row">
                      <button
                        className="btn icon-button"
                        aria-label="Move block up"
                        disabled={index === 0}
                        onClick={() => moveBlock(index, -1)}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        className="btn icon-button"
                        aria-label="Move block down"
                        disabled={index === draft.blocks.length - 1}
                        onClick={() => moveBlock(index, 1)}
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        className="btn"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            blocks: draft.blocks.filter(
                              (item) => item.id !== block.id,
                            ),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <textarea
                    id={`block-${block.id}`}
                    className="field"
                    autoFocus={active === block.id}
                    rows={block.type === "paragraph" ? 5 : 2}
                    placeholder={
                      block.type === "image" || block.type === "video"
                        ? "Description"
                        : undefined
                    }
                    value={block.text}
                    maxLength={20000}
                    onChange={(event) =>
                      updateBlock(block.id, { text: event.target.value })
                    }
                  />
                  {(block.type === "image" || block.type === "video") &&
                    mediaFields(
                      block,
                      block.type,
                      (change) => updateBlock(block.id, change),
                      `${blockLabels[block.type]} URL`,
                    )}
                  {block.type === "image" &&
                    imagePreview(
                      blockSource(block),
                      block.text.trim() || "Page image",
                    )}
                </div>
              ))}
              {!draft.blocks.length && (
                <p className="muted">Add a block to start writing.</p>
              )}
            </fieldset>
          </div>
          <fieldset className="panel stack" disabled={busy}>
            <h2 className="serif">Page details</h2>
            <label>
              Title
              <input
                className="field"
                maxLength={200}
                value={draft.title}
                onChange={(event) => updateTitle(event.target.value)}
              />
            </label>
            <label>
              Template
              <select
                className="field"
                disabled={isCover}
                value={draft.template}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    template: event.target.value as PageContent["template"],
                  })
                }
              >
                {templates.map((template) => (
                  <option key={template}>{template}</option>
                ))}
              </select>
            </label>
            <label>
              Primary contributor
              <select
                className="field"
                value={draft.authors[0] || ""}
                onChange={(event) => {
                  const id = event.target.value;
                  setDraft({
                    ...draft,
                    authors: id
                      ? [
                          id,
                          ...draft.authors
                            .slice(1)
                            .filter((author) => author !== id),
                        ]
                      : [],
                  });
                }}
              >
                <option value="">No contributor</option>
                {authors.map((author) => (
                  <option value={author.id} key={author.id}>
                    {author.name}
                  </option>
                ))}
              </select>
            </label>
            {draft.authors[0] && (
              <div className="stack">
                <strong>Additional contributors</strong>
                {authors
                  .filter((author) => author.id !== draft.authors[0])
                  .map((author) => (
                    <label className="check-label" key={author.id}>
                      <input
                        type="checkbox"
                        checked={draft.authors.includes(author.id)}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            authors: event.target.checked
                              ? [...draft.authors, author.id]
                              : draft.authors.filter((id) => id !== author.id),
                          })
                        }
                      />
                      {author.name}
                    </label>
                  ))}
              </div>
            )}
          </fieldset>
        </div>
      ) : (
        <div className="studio-preview">
          <MagazinePage
            page={draft}
            authors={authors}
            cover={initialMagazine.cover}
          />
        </div>
      )}
      {fullScreenImage && (
        <FullScreenImage
          image={fullScreenImage}
          onClose={() => setFullScreenImage(null)}
        />
      )}
    </div>
  );
}

const headings: Record<View, string> = {
  pages: "Magazine pages",
  reviews: "Review queue",
  publishing: "Ready to publish",
  authors: "Contributors",
  media: "Media library",
  users: "Users",
  inbox: "Reader messages",
};

function PagePreview({
  page,
  authors,
  onClose,
}: {
  page: EditorialPage;
  authors: Author[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="panel studio-profile-dialog page-preview-dialog"
      aria-labelledby="page-preview-title"
      onClose={onClose}
    >
      <div className="page-preview-header">
        <h2 className="serif" id="page-preview-title">
          {page.title}
        </h2>
        <button
          type="button"
          className="studio-icon-button"
          aria-label="Close page preview"
          onClick={() => dialog.current?.close()}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div
        className="page-preview-content"
        role="region"
        aria-label="Page content"
        tabIndex={0}
      >
        <MagazinePage
          page={page}
          authors={authors}
          cover={initialMagazine.cover}
        />
      </div>
    </dialog>
  );
}

export default function Studio({
  initialWorkspace,
}: {
  initialWorkspace: Workspace;
}) {
  const [data, setData] = useState(initialWorkspace);
  const [view, setView] = useState<View>("pages");
  const [selected, setSelected] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState<EditorialPage | null>(null);
  const [busy, setBusy] = useState(false);
  const notify = useSuccessToast();
  const [error, setError] = useState("");
  const [legacy, setLegacy] = useState<ImportCommand | null>(null);
  const [sectionsOpen, setSectionsOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contributorForm, setContributorForm] = useState<Author | "new" | null>(
    null,
  );
  const [deleteCandidate, setDeleteCandidate] = useState<
    { kind: "user"; user: User } | { kind: "page"; page: EditorialPage } | null
  >(null);
  const mobileDrawer = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const viewHeading = useRef<HTMLHeadingElement>(null);
  const contentPanel = useRef<HTMLElement>(null);
  const { user, pages, authors, users, media, uploadsEnabled } = data;
  const isAdmin = permissions.manageUsers(user.role);
  const canEdit = permissions.edit(user.role);
  const coverId = magazineCoverId(pages);
  const page = pages.find((page) => page.id === selected);

  function addMedia(asset: MediaAsset) {
    setData((current) => ({
      ...current,
      media: [asset, ...current.media.filter((item) => item.id !== asset.id)],
    }));
  }

  useEffect(() => {
    if (contentPanel.current) contentPanel.current.scrollTop = 0;
  }, [view, selected]);

  useEffect(() => {
    if (deleteCandidate && !deleteDialog.current?.open)
      deleteDialog.current?.showModal();
  }, [deleteCandidate]);

  useEffect(() => {
    const compact = window.matchMedia(
      "(max-width: 750px), (pointer: coarse) and (max-width: 1000px)",
    );
    const onSizeChange = (event: MediaQueryListEvent) => {
      if (!event.matches) mobileDrawer.current?.close();
    };
    compact.addEventListener("change", onSizeChange);
    return () => compact.removeEventListener("change", onSizeChange);
  }, []);

  useEffect(() => {
    if (!isAdmin || data.browserDraftsImported) return;
    try {
      const saved = JSON.parse(localStorage.getItem("kk-demo-data") || "null");
      if (!Array.isArray(saved?.issues) || !Array.isArray(saved?.authors))
        return;
      const pages = saved.issues.flatMap((item: { pages?: PageContent[] }) =>
        Array.isArray(item.pages) ? item.pages.map(pageContent) : [],
      );
      setLegacy({ action: "importDrafts", pages, authors: saved.authors });
    } catch {
      // Ignore unreadable data from the browser-only prototype.
    }
  }, [isAdmin, data.browserDraftsImported]);

  async function send(command: WorkspaceCommand, success: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-KK-Request": "1" },
        body: JSON.stringify(command),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return null;
      }
      if (!response.ok) throw new Error((await response.json()).error);
      const next: Workspace = await response.json();
      setData(next);
      if (!permissions.manageUsers(next.user.role) && view === "users")
        setView("pages");
      notify(success);
      return next;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The change could not be saved.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function navigate(next: View) {
    setView(next);
    setSelected(null);
    setError("");
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok)
        throw new Error("The dashboard could not be refreshed.");
      setData(await response.json());
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The dashboard could not be refreshed.",
      );
    }
  }

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/session", {
        method: "DELETE",
        headers: { "X-KK-Request": "1" },
      });
      if (!response.ok) throw new Error();
      window.location.assign("/");
    } catch {
      setError("Could not log out. Try again.");
      setBusy(false);
    }
  }

  async function createPage() {
    const id = crypto.randomUUID();
    const result = await send(
      {
        action: "createPage",
        page: {
          id,
          title: "Untitled page",
          template: "Editorial",
          authors: [],
          blocks: [
            { id: crypto.randomUUID(), type: "heading", text: "Untitled page" },
          ],
        },
      },
      "Draft created.",
    );
    if (result) setSelected(id);
  }

  function closeDeleteDialog() {
    deleteDialog.current?.close();
    setDeleteCandidate(null);
  }

  async function confirmDelete() {
    if (busy || !deleteCandidate) return;
    const result = await send(
      deleteCandidate.kind === "page"
        ? {
            action: "deletePage",
            id: deleteCandidate.page.id,
            version: deleteCandidate.page.version,
          }
        : { action: "deleteUser", id: deleteCandidate.user.id },
      deleteCandidate.kind === "page"
        ? "Page deleted."
        : "User account deleted.",
    );
    if (result) {
      closeDeleteDialog();
      if (deleteCandidate.kind === "page") setSelected(null);
      requestAnimationFrame(() => viewHeading.current?.focus());
    }
  }

  const navigation = [
    { id: "pages", icon: FileText, enabled: true },
    { id: "reviews", icon: Check, enabled: permissions.review(user.role) },
    {
      id: "publishing",
      icon: BookOpen,
      enabled: permissions.publish(user.role),
    },
    { id: "authors", icon: Users, enabled: true },
    { id: "media", icon: Images, enabled: true },
    { id: "users", icon: Users, enabled: isAdmin },
    { id: "inbox", icon: Mail, enabled: isAdmin },
  ] as const;

  const currentView = navigation.some(
    (item) => item.id === view && item.enabled,
  )
    ? view
    : "pages";
  const visiblePages = pages.filter((page) =>
    currentView === "reviews"
      ? page.status === "In review"
      : currentView === "publishing"
        ? page.status === "Approved"
        : true,
  );
  const imageUrls = [
    ...new Set([
      initialMagazine.cover,
      ...pages.flatMap((page) =>
        page.blocks.flatMap((block) =>
          block.type === "image" && block.src ? [block.src] : [],
        ),
      ),
    ]),
  ];
  const sectionLinks = (
    <>
      {navigation
        .filter((item) => item.enabled)
        .map(({ id, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className="navlink"
            aria-current={currentView === id ? "page" : undefined}
            disabled={busy}
            onClick={() => {
              mobileDrawer.current?.close();
              void navigate(id);
            }}
          >
            <Icon size={17} aria-hidden="true" />
            {headings[id]}
          </button>
        ))}
      <Link
        href="/"
        className="navlink"
        prefetch={false}
        onClick={() => mobileDrawer.current?.close()}
      >
        <BookOpen size={17} aria-hidden="true" />
        Read magazine
      </Link>
    </>
  );

  return (
    <div className="studio">
      <header className="studio-header">
        <div className="studio-header-start">
          <button
            type="button"
            className="studio-icon-button studio-section-toggle"
            aria-label={
              sectionsOpen
                ? "Hide dashboard sections"
                : "Show dashboard sections"
            }
            aria-expanded={sectionsOpen}
            aria-controls="studio-sections"
            onClick={() => setSectionsOpen(!sectionsOpen)}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="studio-icon-button studio-drawer-toggle"
            aria-label="Open dashboard sections"
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            aria-controls="studio-drawer"
            onClick={() => {
              mobileDrawer.current?.showModal();
              setDrawerOpen(true);
            }}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
          <Link
            href="/"
            className="wordmark"
            aria-label="Read Mozhi magazine"
            prefetch={false}
          >
            <span lang="ml">{magazineName}</span>
          </Link>
        </div>
        <StudioAccount
          user={user}
          busy={busy}
          uploadsEnabled={uploadsEnabled}
          onLogout={logout}
          onUpdated={(updated, detailsChanged) =>
            setData((current) => ({
              ...current,
              user: updated,
              authors:
                detailsChanged && updated.contributorId && updated.profile
                  ? current.authors.map((author) =>
                      author.id === updated.contributorId && updated.profile
                        ? {
                            ...author,
                            name:
                              updated.name === current.user.name
                                ? author.name
                                : updated.name,
                            role: updated.profile.credit,
                            bio: updated.profile.bio,
                            photo: updated.profile.photo,
                            photoAssetId: updated.profile.photoAssetId,
                          }
                        : author,
                    )
                  : current.authors,
              users: current.users.map((account) =>
                account.id === updated.id ? updated : account,
              ),
            }))
          }
        />
      </header>
      <dialog
        id="studio-drawer"
        className="studio-drawer"
        ref={mobileDrawer}
        aria-labelledby="studio-drawer-title"
        onClose={() => setDrawerOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="studio-drawer-inner">
          <div className="studio-drawer-heading">
            <h2 id="studio-drawer-title">Dashboard</h2>
            <button
              type="button"
              className="studio-icon-button"
              aria-label="Close dashboard sections"
              onClick={() => mobileDrawer.current?.close()}
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>
          <nav className="studio-nav" aria-label="Dashboard sections">
            {sectionLinks}
          </nav>
        </div>
      </dialog>
      <div
        className="studio-shell"
        data-sections={sectionsOpen ? "open" : "closed"}
      >
        <nav
          id="studio-sections"
          className="studio-nav studio-nav-desktop"
          aria-label="Dashboard sections"
        >
          {sectionLinks}
        </nav>
        <main
          className="workspace stack"
          ref={contentPanel}
          tabIndex={0}
          aria-label="Dashboard content"
        >
          {selected && (
            <div>
              <button
                className="btn"
                disabled={busy}
                onClick={() => navigate(currentView)}
              >
                Back to {headings[currentView].toLowerCase()}
              </button>
            </div>
          )}
          {error && !deleteCandidate && !contributorForm && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {page ? (
            <PageEditor
              key={`${page.id}-${page.version}`}
              page={page}
              isCover={page.id === coverId}
              authors={authors}
              media={media}
              role={user.role}
              busy={busy}
              send={send}
              uploadsEnabled={uploadsEnabled}
              onBusyChange={setBusy}
              onUploaded={addMedia}
              onDelete={() => {
                setError("");
                setDeleteCandidate({ kind: "page", page });
              }}
            />
          ) : (
            <>
              <div className="workspace-heading">
                <h1 ref={viewHeading} tabIndex={-1}>
                  {headings[currentView]}
                </h1>
                {currentView === "pages" && canEdit && (
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={createPage}
                  >
                    <Plus size={17} />
                    New page
                  </button>
                )}
                {currentView === "authors" && canEdit && (
                  <button
                    type="button"
                    className="btn primary"
                    disabled={busy}
                    aria-haspopup="dialog"
                    onClick={() => {
                      setError("");
                      setContributorForm("new");
                    }}
                  >
                    <Plus size={17} aria-hidden="true" />
                    Add contributor
                  </button>
                )}
              </div>
              {currentView === "pages" &&
                isAdmin &&
                !data.browserDraftsImported &&
                legacy && (
                  <div className="panel panel-heading">
                    <p className="text-sm">
                      Bring pages saved by the earlier app in this browser into
                      the magazine as drafts.
                    </p>
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={async () => {
                        if (await send(legacy, "Browser drafts imported."))
                          setLegacy(null);
                      }}
                    >
                      Import browser drafts
                    </button>
                  </div>
                )}
              {(["pages", "reviews", "publishing"] as View[]).includes(
                currentView,
              ) && (
                <PageList
                  coverId={coverId}
                  pages={visiblePages}
                  busy={busy}
                  canReorder={currentView === "pages" && canEdit}
                  action={currentView === "reviews" ? "Review" : "Open"}
                  empty={
                    currentView === "reviews"
                      ? "No pages are awaiting review."
                      : currentView === "publishing"
                        ? "No pages are ready to publish."
                        : "No magazine pages yet."
                  }
                  onOpen={(id) => {
                    setSelected(id);
                    setError("");
                  }}
                  onPreview={
                    currentView === "pages" ? setPreviewPage : undefined
                  }
                  onMove={(command) => send(command, "Page order saved.")}
                />
              )}
              {currentView === "authors" && (
                <Contributors
                  authors={authors}
                  form={contributorForm}
                  accounts={isAdmin ? users : undefined}
                  busy={busy}
                  error={error}
                  uploadsEnabled={uploadsEnabled}
                  onBusyChange={setBusy}
                  onEdit={(author) => {
                    setError("");
                    setContributorForm(author);
                  }}
                  onClose={() => {
                    setError("");
                    setContributorForm(null);
                  }}
                  onSave={async (id, author, accountId, newPassword) =>
                    Boolean(
                      await (contributorForm && contributorForm !== "new"
                        ? send(
                            {
                              action: "editAuthor",
                              id,
                              author,
                              accountId,
                              newPassword,
                            },
                            newPassword
                              ? "Contributor updated and password reset."
                              : "Contributor updated.",
                          )
                        : send(
                            { action: "addAuthor", id, author },
                            "Contributor added.",
                          )),
                    )
                  }
                />
              )}
              {currentView === "inbox" && isAdmin && <ContactInbox />}
              {currentView === "media" && (
                <MediaLibrary
                  assets={media}
                  imageUrls={imageUrls}
                  canEdit={canEdit}
                  canDelete={isAdmin}
                  enabled={uploadsEnabled}
                  busy={busy}
                  onBusyChange={setBusy}
                  onUploaded={addMedia}
                  onDeleted={(id) =>
                    setData((current) => ({
                      ...current,
                      media: current.media.filter((asset) => asset.id !== id),
                    }))
                  }
                />
              )}
              {currentView === "users" && isAdmin && (
                <>
                  <NewUserForm busy={busy} send={send} />
                  <div className="panel record-list">
                    {users.map((account) => (
                      <form
                        className="record"
                        key={`${account.id}-${account.role}`}
                        onSubmit={(event) => {
                          event.preventDefault();
                          const fields = new FormData(event.currentTarget);
                          void send(
                            {
                              action: "changeRole",
                              id: account.id,
                              role: fields.get("role") as Role,
                            },
                            "Role updated.",
                          );
                        }}
                      >
                        <div>
                          <strong>{account.name}</strong>
                          <div className="muted record-detail">
                            {account.email}
                          </div>
                        </div>
                        <select
                          className="field role-field"
                          aria-label={`Role for ${account.name}`}
                          name="role"
                          defaultValue={account.role}
                          disabled={busy}
                        >
                          {roles.map((role) => (
                            <option key={role}>{role}</option>
                          ))}
                        </select>
                        <div className="button-row">
                          <button className="btn" disabled={busy}>
                            Save role
                          </button>
                          {account.role !== "Admin" && (
                            <button
                              className="btn delete-action"
                              type="button"
                              disabled={busy}
                              aria-label={`Delete ${account.name}`}
                              onClick={() => {
                                setError("");
                                setDeleteCandidate({
                                  kind: "user",
                                  user: account,
                                });
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </form>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
      {previewPage && (
        <PagePreview
          page={previewPage}
          authors={authors}
          onClose={() => setPreviewPage(null)}
        />
      )}
      <dialog
        className="studio-delete-dialog panel"
        ref={deleteDialog}
        aria-labelledby="studio-delete-title"
        aria-describedby="studio-delete-description"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) closeDeleteDialog();
        }}
      >
        {deleteCandidate && (
          <div className="stack">
            <h2 className="serif" id="studio-delete-title">
              {deleteCandidate.kind === "page"
                ? "Delete page?"
                : "Delete user account?"}
            </h2>
            <p id="studio-delete-description">
              {deleteCandidate.kind === "page" ? (
                <>
                  Permanently delete{" "}
                  <strong>{deleteCandidate.page.title}</strong> and its
                  publication history? Any live version will be removed from the
                  reader.
                </>
              ) : (
                <>
                  <strong>{deleteCandidate.user.name}</strong> (
                  {deleteCandidate.user.email}) will lose dashboard access and
                  be signed out of active sessions.
                </>
              )}
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="button-row studio-delete-actions">
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={closeDeleteDialog}
              >
                Cancel
              </button>
              <button
                className="btn danger"
                type="button"
                disabled={busy}
                onClick={confirmDelete}
              >
                {busy
                  ? "Deleting…"
                  : deleteCandidate.kind === "page"
                    ? "Delete page"
                    : "Delete account"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
