"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { LayoutEntry } from "@/lib/landing-layout";

function entryKey(entry: LayoutEntry) {
  return `${entry.type}:${entry.id}`;
}

function SortableBlockCard({ entry, children }: { entry: LayoutEntry; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entryKey(entry) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch gap-2">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex w-8 shrink-0 cursor-grab items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)] active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export default function BlockList({
  entries,
  onReorder,
  renderItem,
}: {
  entries: LayoutEntry[];
  onReorder: (next: LayoutEntry[]) => void;
  renderItem: (entry: LayoutEntry) => ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = entries.findIndex((entry) => entryKey(entry) === active.id);
    const to = entries.findIndex((entry) => entryKey(entry) === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(entries, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={entries.map(entryKey)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {entries.map((entry) => (
            <SortableBlockCard key={entryKey(entry)} entry={entry}>
              {renderItem(entry)}
            </SortableBlockCard>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
