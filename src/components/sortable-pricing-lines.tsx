"use client";

import * as React from "react";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";

import { Button } from "@/components/ui/button";

const HandleContext = React.createContext<ReturnType<typeof useSortable> | null>(null);

export function SortablePricingLines<T extends { id: string }>({
  items,
  onChange,
  children,
  className,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        const from = items.findIndex((item) => item.id === active.id);
        const to = items.findIndex((item) => item.id === over.id);
        if (from >= 0 && to >= 0) onChange(arrayMove(items, from, to));
      }}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  );
}

export function SortablePricingLine({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const sortable = useSortable({ id });
  return (
    <HandleContext.Provider value={sortable}>
      <div
        ref={sortable.setNodeRef}
        className={className}
        style={{
          transform: sortable.transform
            ? `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0)`
            : undefined,
          transition: sortable.transition,
          position: "relative",
          zIndex: sortable.isDragging ? 1 : undefined,
          opacity: sortable.isDragging ? 0.75 : 1,
        }}
      >
        {children}
      </div>
    </HandleContext.Provider>
  );
}

export function PricingLineDragHandle({ label }: { label: string }) {
  const sortable = React.useContext(HandleContext);
  if (!sortable) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      ref={sortable.setActivatorNodeRef}
      {...sortable.attributes}
      {...sortable.listeners}
      aria-label={label}
      title="Drag to reorder, or press Space and use arrow keys"
      className="size-8 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </Button>
  );
}
