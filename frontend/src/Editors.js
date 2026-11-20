import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { isPosterAddress, statuses, tiers } from './library';
import { SeasonFields } from './SeasonFields';

export function Dialog({ title, onDismiss, children }) {
  const dialog = useRef(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!dialog.current.open) {
      dialog.current.showModal();
      if (!window.matchMedia('(pointer: coarse)').matches) {
        dialog.current.querySelector('[data-initial-focus]')?.focus();
      }
    }
  }, []);

  const dismiss = () => {
    if (pending.current) return;
    dialog.current.close();
    onDismiss();
  };

  const run = async (action, closeOnSuccess = true) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setActionError('');
    try {
      await action();
    } catch (error) {
      setActionError(error.message);
      closeOnSuccess = false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
    if (closeOnSuccess) dismiss();
  };

  return (
    <dialog ref={dialog} className="editor" aria-labelledby="editor-title"
      onCancel={(event) => { event.preventDefault(); dismiss(); }}>
      <div className="editor-heading">
        <h2 id="editor-title">{title}</h2>
        <button type="button" className="icon-button" aria-label="Закрити" disabled={busy} onClick={dismiss}><X size={20} /></button>
      </div>
      {children({ dismiss, run, busy, actionError })}
    </dialog>
  );
}

const emptyEntry = { title: '', category: '', year: '', status: 'planned', tier: '', score: null, review: '', poster: '',
  watchedEpisodes: 0, totalEpisodes: null, seasons: [] };

function seasonProgress(draft, seasons) {
  const totalEpisodes = seasons.reduce((sum, season) => sum + (season.totalEpisodes || 0), 0);
  const watchedEpisodes = seasons.reduce((sum, season) => sum + season.watchedEpisodes, 0);
  const complete = seasons.every((season) => season.totalEpisodes > 0 && season.watchedEpisodes === season.totalEpisodes);
  const status = complete ? 'watched' : watchedEpisodes || draft.status === 'watching' ? 'watching' : 'planned';
  return { ...draft, seasons, totalEpisodes: totalEpisodes || null, watchedEpisodes, status };
}

export function EntryEditor({ entry, category, categories, onSave, onDelete, onCancel, busy, actionError }) {
  const [draft, setDraft] = useState(() => entry ?? { ...emptyEntry, category: category || categories[0]?.id || '' });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleInput = useRef(null);
  const deleteInput = useRef(null);
  const seasons = draft.seasons ?? [];

  const addSeason = () => setDraft((current) => {
    const currentSeasons = current.seasons ?? [];
    const season = currentSeasons.length ? { totalEpisodes: null, watchedEpisodes: 0 } :
      { totalEpisodes: current.totalEpisodes, watchedEpisodes: current.watchedEpisodes };
    return seasonProgress(current, [...currentSeasons, season]);
  });

  const removeSeason = () => setDraft((current) => {
    const remaining = current.seasons.slice(0, -1);
    return remaining.length ? seasonProgress(current, remaining) : { ...current, seasons: [] };
  });

  const changeSeason = (index, field, value) => {
    setDraft((current) => seasonProgress(current, current.seasons.map((season, position) => {
      if (position !== index) return season;
      if (field === 'watchedEpisodes') return { ...season, watchedEpisodes: Number(value) };
      const totalEpisodes = value === '' ? null : Number(value);
      return { totalEpisodes, watchedEpisodes: Math.min(season.watchedEpisodes, Math.max(totalEpisodes ?? 0, 0)) };
    })));
    setError('');
  };

  const change = (event) => {
    const { name, value } = event.target;
    setDraft((previous) => {
      if (name === 'totalEpisodes') {
        const total = value ? Number(value) : null;
        const watched = total ? (previous.status === 'watched' ? total : Math.min(previous.watchedEpisodes, total)) : 0;
        return { ...previous, totalEpisodes: total, watchedEpisodes: watched };
      }
      if (name === 'watchedEpisodes') {
        const watched = value === '' ? 0 : Number(value);
        const status = watched === previous.totalEpisodes ? 'watched' : watched ? 'watching' : 'planned';
        return { ...previous, watchedEpisodes: watched, status };
      }
      if (name === 'status' && previous.totalEpisodes) {
        if (previous.seasons?.length) {
          const reset = value === 'planned' || previous.status === 'watched';
          const updated = previous.seasons.map((season) => ({
            ...season, watchedEpisodes: value === 'watched' ? (season.totalEpisodes ?? 0) : reset ? 0 : season.watchedEpisodes,
          }));
          return seasonProgress({ ...previous, status: value }, updated);
        }
        const watched = value === 'watched' ? previous.totalEpisodes :
          value === 'planned' || previous.status === 'watched' ? 0 : previous.watchedEpisodes;
        return { ...previous, status: value, watchedEpisodes: watched };
      }
      return { ...previous, [name]: name === 'score' ? (value === '' ? null : Number(value)) : value };
    });
    setError('');
  };

  const submit = (event) => {
    event.preventDefault();
    if (busy || confirmDelete) return;
    const title = draft.title.trim();
    const poster = draft.poster.trim();
    if (!title) {
      setError('Введи назву запису.');
      titleInput.current.focus();
      return;
    }
    if (poster !== entry?.poster && !isPosterAddress(poster)) {
      setError('Введи повну адресу постера, що починається з https:// або http://.');
      return;
    }
    onSave({ ...draft, title, poster, review: draft.review.trim() });
  };

  return (
    <form className="editor-form" onSubmit={submit}>
      <fieldset className="editor-fields" disabled={busy || confirmDelete}>
        <label className="field">
          Назва
          <input ref={titleInput} data-initial-focus="" name="title" required maxLength={100} value={draft.title} onChange={change} />
        </label>
        <div className="field-pair">
          <label className="field">Категорія
            <select name="category" required value={draft.category} onChange={change}>
              {categories.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="field">Рік
            <input name="year" type="number" min={1888} max={2100} step={1} value={draft.year} onChange={change} />
          </label>
        </div>
        {seasons.length === 0 && <fieldset className="episode-fields">
          <legend>Прогрес епізодів <span className="optional">(необов’язково)</span></legend>
          <div className="field-pair">
            <label className="field">Усього епізодів
              <input name="totalEpisodes" type="number" min={1} max={10000} step={1} inputMode="numeric"
                placeholder="—" value={draft.totalEpisodes ?? ''} onChange={change} />
            </label>
            <label className="field">Переглянуто епізодів
              <input name="watchedEpisodes" type="number" min={0} max={draft.totalEpisodes ?? 0} step={1} inputMode="numeric"
                disabled={!draft.totalEpisodes} value={draft.watchedEpisodes || ''} placeholder="0" onChange={change} />
            </label>
          </div>
        </fieldset>}
        <SeasonFields seasons={seasons} onAdd={addSeason} onRemove={removeSeason} onChange={changeSeason} />
        <div className="field-pair">
          <label className="field">Статус
            <select name="status" value={draft.status} onChange={change}>
              {statuses.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="field">Бал із 10
            <select name="score" value={draft.score ?? ''} onChange={change}>
              <option value="">Без бала</option>
              {Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
            </select>
          </label>
        </div>
        <fieldset className="tier-picker">
          <legend>Рівень у тірлісті</legend>
          <div className="tier-options">
            {[...tiers, ['', 'Без рівня']].map(([value, label]) => (
              <label className="tier-option" key={label} data-tier={value || undefined}>
                <input type="radio" name="tier" value={value} checked={draft.tier === value} onChange={change}
                  aria-label={value ? `${value} — ${label}` : label} />
                <span>{value || '—'}</span>
              </label>
            ))}
          </div>
          <p className="tier-hint" aria-live="polite">
            {tiers.find(([value]) => value === draft.tier)?.[1] ?? 'Без рівня'}
          </p>
        </fieldset>
        <label className="field">Відгук
          <textarea name="review" rows={3} maxLength={2000} value={draft.review} onChange={change} />
        </label>
        <label className="field">URL постера <span className="optional">(необов’язково)</span>
          <input name="poster" inputMode="url" maxLength={2048} value={draft.poster} onChange={change} />
        </label>
      </fieldset>
      {confirmDelete
        ? <div className="editor-actions delete-confirm">
            {actionError && <p className="form-error" role="alert">{actionError}</p>}
            <p>Видалити «{entry.title}» з колекції?</p>
            <button type="button" className="button secondary" autoFocus disabled={busy} onClick={() => {
              setConfirmDelete(false);
              requestAnimationFrame(() => deleteInput.current?.focus());
            }}>Залишити запис</button>
            <button type="button" className="button danger" disabled={busy} onClick={onDelete}>{busy ? 'Видаляємо…' : 'Видалити'}</button>
          </div>
        : <div className="editor-actions">
            {(error || actionError) && <p className="form-error" role="alert">{error || actionError}</p>}
            {entry && <button ref={deleteInput} type="button" className="icon-button delete" aria-label="Видалити запис"
              disabled={busy} onClick={() => setConfirmDelete(true)}><Trash2 size={19} /></button>}
            <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>Скасувати</button>
            <button type="submit" className="button primary" disabled={busy}>{busy ? 'Зберігаємо…' : 'Зберегти запис'}</button>
          </div>}
    </form>
  );
}

export function CategoryEditor({ categories, onSave, onCancel, busy, actionError }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const submit = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) setError('Введи назву категорії.');
    else if (categories.some((category) => category.name.toLocaleLowerCase('uk') === trimmed.toLocaleLowerCase('uk'))) {
      setError('Категорія з такою назвою вже є.');
    } else onSave(trimmed);
  };

  return (
    <form className="editor-form" onSubmit={submit}>
      <label className="field">Назва категорії
        <input data-initial-focus="" required maxLength={40} disabled={busy} value={name}
          onChange={(event) => { setName(event.target.value); setError(''); }} />
      </label>
      <div className="editor-actions">
        {(error || actionError) && <p className="form-error" role="alert">{error || actionError}</p>}
        <button className="button secondary" type="button" disabled={busy} onClick={onCancel}>Скасувати</button>
        <button className="button primary" type="submit" disabled={busy}>{busy ? 'Створюємо…' : 'Створити категорію'}</button>
      </div>
    </form>
  );
}
