import { useEffect, useRef, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { GripVertical, Layers3 } from 'lucide-react';
import { Poster } from './LibraryViews';
import { tiers } from './library';

const levels = [...tiers, ['', 'Без рівня']];
const gripId = (id) => 'tier-grip-' + id;
const announcements = {
  onDragStart({ active }) {
    return `Перетягуємо «${active.data.current.entry.title}».`;
  },
  onDragOver({ over }) {
    if (over) return `Рівень ${over.data.current.tier || 'Без рівня'}.`;
  },
  onDragEnd() {},
  onDragCancel() { return 'Перетягування скасовано.'; },
};

function RankedContent({ entry }) {
  return (
    <>
      <Poster entry={entry} />
      <span className="ranked-name">{entry.title}{entry.score != null && <small>{entry.score}/10</small>}</span>
    </>
  );
}

function RankedItem({ entry, busy, onEdit, onMove }) {
  const { setNodeRef, setActivatorNodeRef, listeners, isDragging } = useDraggable({
    id: entry.id, data: { entry }, disabled: busy,
  });
  const [choosing, setChoosing] = useState(false);
  const choice = useRef(null);

  useEffect(() => {
    if (choosing) choice.current?.focus();
  }, [choosing]);

  return (
    <li ref={setNodeRef} className="ranked-item" data-dragging={isDragging || undefined}>
      <div className="ranked-card">
        <button type="button" className="ranked-title" onClick={() => onEdit(entry)}
          onPointerDown={(event) => {
            if (event.pointerType === 'mouse') listeners?.onPointerDown?.(event);
          }}>
          <RankedContent entry={entry} />
        </button>
        <button type="button" className="tier-grip" id={gripId(entry.id)} ref={setActivatorNodeRef}
          aria-label={`Перемістити «${entry.title}»`} aria-expanded={choosing}
          disabled={busy} onClick={() => setChoosing((open) => !open)} {...listeners}>
          <GripVertical size={19} aria-hidden="true" />
        </button>
      </div>
      {choosing && <select className="tier-choice" ref={choice} aria-label={`Рівень для «${entry.title}»`}
        value={entry.tier} onBlur={() => setChoosing(false)}
        onChange={(event) => {
          setChoosing(false);
          onMove(entry, event.target.value, true);
        }}>
        {levels.map(([tier, label]) => <option key={tier} value={tier}>{tier ? `${tier} — ${label}` : label}</option>)}
      </select>}
    </li>
  );
}

function TierRow({ tier, label, entries, busy, onEdit, onMove }) {
  const id = 'tier-' + (tier || 'none');
  const { isOver, setNodeRef } = useDroppable({ id, data: { tier }, disabled: busy });
  return (
    <section className="tier-row" ref={setNodeRef} data-drop-active={isOver || undefined} aria-labelledby={id}>
      <h3 id={id}>
        {tier ? <span className="tier-mark" data-tier={tier}>{tier}</span> : <Layers3 size={21} aria-hidden="true" />}
        {label}
      </h3>
      {entries.length ? <ul className="ranked">
        {entries.map((entry) => <RankedItem key={entry.id} entry={entry} busy={busy} onEdit={onEdit} onMove={onMove} />)}
      </ul> : <p className="tier-empty">Поки порожньо</p>}
    </section>
  );
}

export function TierBoard({ entries, onEdit, onTierChange }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }));
  const [dragged, setDragged] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  async function move(entry, tier, restoreFocus = false) {
    if (entry.tier === tier || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await onTierChange(entry, tier);
    } catch (failure) {
      setError(failure.code === 'STALE_ENTRY'
        ? 'Запис змінився в іншій вкладці. Спробуй перемістити його ще раз.'
        : failure.message);
    } finally {
      inFlight.current = false;
      setBusy(false);
      if (restoreFocus) requestAnimationFrame(() => document.getElementById(gripId(entry.id))?.focus());
    }
  }

  function endDrag({ active, over }) {
    setDragged(null);
    const tier = over?.data.current?.tier;
    if (typeof tier === 'string') move(active.data.current.entry, tier);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} accessibility={{ announcements }}
      onDragStart={({ active }) => setDragged(active.data.current.entry)}
      onDragCancel={() => setDragged(null)} onDragEnd={endDrag}>
      <p className="tier-board-help">Перетягни картку за ручку або натисни її, щоб вибрати рівень.</p>
      {busy && <p role="status" className="sr-only">Зберігаємо рівень…</p>}
      {error && <p role="alert" className="message error-panel tier-move-error">{error}</p>}
      <div className="tier-board" data-dragging={Boolean(dragged) || undefined}>
        {levels.map(([tier, label]) => <TierRow key={tier} tier={tier} label={label}
          entries={entries.filter((entry) => entry.tier === tier)} busy={busy} onEdit={onEdit} onMove={move} />)}
      </div>
      <DragOverlay dropAnimation={null}>
        {dragged && <div className="ranked ranked-preview" aria-hidden="true">
          <RankedContent entry={dragged} />
          <GripVertical size={19} />
        </div>}
      </DragOverlay>
    </DndContext>
  );
}
