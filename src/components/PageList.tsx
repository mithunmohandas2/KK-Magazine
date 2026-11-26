"use client";

import { useId } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, GripVertical, Lock, Pencil } from "lucide-react";
import { pageContributorNames, type Author, type EditorialPage } from "@/lib/data";

type PageAction = "Edit" | "Open" | "Review";

function PageRow({
  page,
  authorNames,
  busy,
  reordering,
  fixed,
  action,
  onOpen,
  onPreview,
}: {
  page: EditorialPage;
  authorNames: string;
  busy: boolean;
  reordering: boolean;
  fixed: boolean;
  action: PageAction;
  onOpen: (id: string) => void;
  onPreview?: (page: EditorialPage) => void;
}) {
  const disabled = !reordering || fixed || busy;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: page.id,
    disabled: { draggable: disabled, droppable: disabled },
  });
  return (
    <div
      ref={setNodeRef}
      className={
        reordering
          ? "record page-record"
          : action === "Edit"
            ? "record magazine-page-record"
            : "record"
      }
      data-page-status={page.status}
      data-dragging={isDragging || undefined}
      style={{
        transform: transform
          ? CSS.Translate.toString({ ...transform, x: 0 })
          : undefined,
        transition,
      }}
    >
      {reordering &&
        (fixed ? (
          <span className="page-order-handle" title="Cover stays first">
            <Lock size={17} role="img" aria-label="Cover stays first" />
          </span>
        ) : (
          <button
            type="button"
            className="page-order-handle"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-disabled={disabled}
            aria-label={`Reorder ${page.title}`}
          >
            <GripVertical size={20} aria-hidden="true" />
          </button>
        ))}
      <div className="page-list-summary">
        <strong className="page-list-title" title={page.title}>
          {page.title}
        </strong>
        <div className="page-list-metadata">
          <div className="muted record-detail">{page.template}</div>
          {authorNames && (
            <em className="muted record-detail page-list-authors">
              {authorNames}
            </em>
          )}
        </div>
      </div>
      <span className="pill">{page.status}</span>
      {!reordering && (
        <div className="page-list-actions">
          {onPreview && (
            <button
              type="button"
              className="btn icon-button"
              title="Preview"
              aria-haspopup="dialog"
              aria-label={`Preview ${page.title}`}
              disabled={busy}
              onClick={() => onPreview(page)}
            >
              <Eye size={16} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className={action === "Edit" ? "btn icon-button" : "btn"}
            title={action === "Edit" ? "Edit" : undefined}
            aria-label={action === "Edit" ? `Edit ${page.title}` : undefined}
            disabled={busy}
            onClick={() => onOpen(page.id)}
          >
            {action === "Edit" ? <Pencil size={16} aria-hidden="true" /> : action}
          </button>
        </div>
      )}
    </div>
  );
}

export default function PageList({
  pages,
  authors,
  coverId,
  busy,
  reordering,
  action,
  empty,
  onOpen,
  onPreview,
  onReorder,
}: {
  pages: EditorialPage[];
  authors: Author[];
  coverId?: string;
  busy: boolean;
  reordering: boolean;
  action: PageAction;
  empty: string;
  onOpen: (id: string) => void;
  onPreview?: (page: EditorialPage) => void;
  onReorder: (order: string[]) => void;
}) {
  const contextId = useId();
  const authorsById = new Map(authors.map((author) => [author.id, author]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function move({ active, over }: DragEndEvent) {
    if (
      !reordering ||
      busy ||
      !over ||
      active.id === over.id ||
      active.id === coverId ||
      over.id === coverId
    )
      return;
    const from = pages.findIndex((page) => page.id === active.id);
    const to = pages.findIndex((page) => page.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(pages, from, to).map((page) => page.id));
  }

  const title = (id: string | number) =>
    pages.find((page) => page.id === id)?.title ?? "Page";
  return (
    <div className="panel record-list">
      <DndContext
        id={contextId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={move}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
            onDragOver: ({ active, over }) =>
              over && active.id !== over.id
                ? `${title(active.id)} over ${title(over.id)}.`
                : undefined,
            onDragEnd: ({ active, over }) =>
              over
                ? `Dropped ${title(active.id)}.`
                : `Move cancelled for ${title(active.id)}.`,
            onDragCancel: ({ active }) =>
              `Move cancelled for ${title(active.id)}.`,
          },
        }}
      >
        <SortableContext
          items={pages
            .filter((page) => page.id !== coverId)
            .map((page) => page.id)}
          strategy={verticalListSortingStrategy}
        >
          {pages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              authorNames={pageContributorNames(page, authorsById)}
              busy={busy}
              reordering={reordering}
              fixed={page.id === coverId}
              action={action}
              onOpen={onOpen}
              onPreview={onPreview}
            />
          ))}
        </SortableContext>
      </DndContext>
      {!pages.length && <p className="empty-state">{empty}</p>}
    </div>
  );
}
