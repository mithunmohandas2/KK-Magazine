"use client";

import { useId, useState } from "react";
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
import { Eye, GripVertical, Lock } from "lucide-react";
import type { WorkspaceCommand } from "@/lib/commands";
import type { EditorialPage } from "@/lib/data";

type MovePage = Extract<WorkspaceCommand, { action: "movePage" }>;

function PageRow({
  page,
  busy,
  showHandle,
  fixed,
  action,
  onOpen,
  onPreview,
}: {
  page: EditorialPage;
  busy: boolean;
  showHandle: boolean;
  fixed: boolean;
  action: string;
  onOpen: (id: string) => void;
  onPreview?: (page: EditorialPage) => void;
}) {
  const disabled = !showHandle || fixed || busy;
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
      className={showHandle ? "record page-record" : "record"}
      data-dragging={isDragging || undefined}
      style={{
        transform: transform
          ? CSS.Translate.toString({ ...transform, x: 0 })
          : undefined,
        transition,
      }}
    >
      {showHandle &&
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
      <div>
        <strong>{page.title}</strong>
        <div className="muted record-detail">{page.template}</div>
      </div>
      <span className="pill">{page.status}</span>
      <div className="page-list-actions">
        {onPreview && (
          <button type="button" className="btn" aria-haspopup="dialog"
            aria-label={`Preview ${page.title}`} disabled={busy} onClick={() => onPreview(page)}>
            <Eye size={16} aria-hidden="true" />
            Preview
          </button>
        )}
        <button type="button" className="btn" disabled={busy} onClick={() => onOpen(page.id)}>
          {action}
        </button>
      </div>
    </div>
  );
}

export default function PageList({
  pages,
  coverId,
  busy,
  canReorder,
  action,
  empty,
  onOpen,
  onPreview,
  onMove,
}: {
  pages: EditorialPage[];
  coverId?: string;
  busy: boolean;
  canReorder: boolean;
  action: string;
  empty: string;
  onOpen: (id: string) => void;
  onPreview?: (page: EditorialPage) => void;
  onMove: (command: MovePage) => Promise<unknown>;
}) {
  const contextId = useId();
  const [pending, setPending] = useState<EditorialPage[] | null>(null);
  const items = pending ?? pages;
  const showHandle = canReorder && items.length - Number(Boolean(coverId)) > 1;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function move({ active, over }: DragEndEvent) {
    if (!showHandle || busy || pending || !over || active.id === over.id)
      return;
    const from = items.findIndex((page) => page.id === active.id);
    const to = items.findIndex((page) => page.id === over.id);
    if (from < 0 || to < 0) return;
    setPending(arrayMove(items, from, to));
    try {
      await onMove({
        action: "movePage",
        id: items[from].id,
        targetId: items[to].id,
        placement: from < to ? "after" : "before",
      });
    } finally {
      setPending(null);
    }
  }

  const title = (id: string | number) =>
    items.find((page) => page.id === id)?.title ?? "Page";
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
          items={items.map((page) => page.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((page, index) => (
            <PageRow
              key={page.id + index}
              page={page}
              busy={busy}
              showHandle={showHandle}
              fixed={page.id === coverId}
              action={action}
              onOpen={onOpen}
              onPreview={onPreview}
            />
          ))}
        </SortableContext>
      </DndContext>
      {!items.length && <p className="empty-state">{empty}</p>}
    </div>
  );
}
