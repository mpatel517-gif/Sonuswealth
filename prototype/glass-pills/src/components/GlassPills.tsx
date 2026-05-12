import React from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, KeyboardSensor } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';

type Pill = { id: string; label: string; amount: number };

const PillsSchema = z.object({
  pills: z.array(
    z.object({
      id: z.string(),
      label: z.string().min(1, 'Label required'),
      amount: z.number().min(0, 'Amount must be ≥ 0'),
    })
  )
}).superRefine((val, ctx) => {
  if (!val.pills.some((p: any) => p.amount > 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one pill must have an amount > 0' });
  }
});

export default function GlassPills({ initial }: { initial: Pill[] }) {
  const { control, handleSubmit, formState } = useForm<{ pills: Pill[] }>({
    resolver: zodResolver(PillsSchema),
    defaultValues: { pills: initial },
    mode: 'onBlur'
  });
  const { fields, move } = useFieldArray({ control, name: 'pills' });

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  function onDragEnd(e: any) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex(f => f.id === active.id);
    const newIndex = fields.findIndex(f => f.id === over.id);
    move(oldIndex, newIndex);
  }

  function onSubmit(data: any) {
    alert('Saved order — see console for data');
    console.log('Saved pills', data.pills);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} aria-label="Pill sequence">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <SortableContext items={fields.map(f => f.id)} strategy={rectSortingStrategy}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {fields.map((f, i) => (
              <SortablePill key={f.id} id={f.id} label={f.label} amount={(f as any).amount} index={i} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div style={{ marginTop: 16 }}>
        <button type="submit" className="glass-btn">Save order</button>
        {formState.errors && (
          <div role="alert" style={{ marginTop: 8, color: 'var(--danger)' }}>
            {JSON.stringify(formState.errors)}
          </div>
        )}
      </div>
    </form>
  );
}

function SortablePill({ id, label, amount, index }: { id: string; label: string; amount: number; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined,
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={clsx('pill', isDragging && 'dragging')} role="listitem" tabIndex={0}>
      <span className="pill-handle" aria-hidden>≡</span>
      <div className="pill-content">
        <div className="pill-title">{label}</div>
        <div className="pill-meta">£{amount.toLocaleString()}</div>
      </div>
    </div>
  );
}
