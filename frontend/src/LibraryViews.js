import { useRef, useState } from 'react';
import { Check, Film, Shuffle, Star } from 'lucide-react';
import { statuses } from './library';
import { libraryApi } from './libraryApi';
import { useApiResource } from './useApiResource';

export function Poster({ entry, eager = false }) {
  const [brokenPoster, setBrokenPoster] = useState('');
  return (
    <span className="poster" aria-hidden="true">
      <span className="poster-fallback"><Film size={36} strokeWidth={1.2} /></span>
      {entry.poster && entry.poster !== brokenPoster && (
        <img src={entry.poster} alt="" loading={eager ? 'eager' : 'lazy'}
          decoding="async" referrerPolicy="no-referrer" onError={() => setBrokenPoster(entry.poster)} />
      )}
    </span>
  );
}

const readSuggestion = (signal) => libraryApi.suggest(undefined, signal);

export function Suggestion({ categories, canShuffle, busy, actionError, onShuffle, onStart }) {
  const { data: entry, error, retry, setData } = useApiResource(readSuggestion);
  if (!entry) {
    return (
      <div className="suggestion suggestion-status">
        {error ? <>
          <p role="alert">{error.message}</p>
          {error.code !== 'NO_PLANS' && <button type="button" className="button secondary" onClick={retry}>Повторити</button>}
        </> : <p role="status">Шукаємо в планах…</p>}
      </div>
    );
  }
  const category = categories.find(({ id }) => id === entry.category)?.name;
  return (
    <div className="suggestion">
      <div className="suggestion-record">
        <Poster entry={entry} eager />
        <div aria-live="polite">
          <h3>{entry.title}</h3>
          <p className="suggestion-meta">{[category, entry.year].filter(Boolean).join(' · ')}</p>
          {entry.review && <p className="suggestion-note">{entry.review}</p>}
        </div>
      </div>
      <div className="editor-actions">
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {canShuffle && <button type="button" className="button secondary" disabled={busy}
          onClick={() => onShuffle(async () => setData(await libraryApi.suggest(entry.id)))}>
          <Shuffle size={16} aria-hidden="true" /> Інший варіант
        </button>}
        <button type="button" className="button primary" disabled={busy} onClick={() => onStart(entry)}>
          <Check size={16} aria-hidden="true" /> Позначити «Дивлюсь»
        </button>
      </div>
    </div>
  );
}

function CollectionEntry({ entry, category, eager, onEdit, onAdvance }) {
  const entryButton = useRef(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const seasons = entry.seasons ?? [];
  const currentSeason = seasons.findIndex((season) => season.watchedEpisodes < season.totalEpisodes);

  async function advance() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await onAdvance(entry);
      if (updated.status === 'watched') requestAnimationFrame(() => entryButton.current?.focus());
    } catch (failure) {
      setError(failure.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <li>
      <button ref={entryButton} type="button" className="entry" onClick={() => onEdit(entry)}>
        <span className="entry-cover">
          <Poster entry={entry} eager={eager} />
          {entry.tier && <span className="tier-badge" data-tier={entry.tier} aria-label={`Рівень ${entry.tier}`}>{entry.tier}</span>}
          {entry.score != null
            ? <span className="score"><Star size={13} fill="currentColor" aria-hidden="true" />{entry.score}<span className="score-max">/10</span></span>
            : <span className="view-state">{statuses.find(([id]) => id === entry.status)?.[1]}</span>}
        </span>
        <span className="entry-title">{entry.title}</span>
        <span className="entry-meta">
          {category}
          {entry.year && <> <span aria-hidden="true">·</span> {entry.year}</>}
        </span>
      </button>
      {entry.totalEpisodes && (
        <div className="entry-progress">
          <div>
            <span>{entry.watchedEpisodes} / {entry.totalEpisodes} еп.</span>
            <progress value={entry.watchedEpisodes} max={entry.totalEpisodes} aria-label={`Прогрес: ${entry.title}`} />
            {seasons.length > 0 && <small>{currentSeason >= 0
              ? `Сезон ${currentSeason + 1} з ${seasons.length}` : `Сезонів: ${seasons.length}`}</small>}
          </div>
          {entry.watchedEpisodes < entry.totalEpisodes && (
            <button type="button" className="icon-button episode-step" disabled={busy}
              aria-label={`Позначити ще один епізод: ${entry.title}`} onClick={advance}>
              +1
            </button>
          )}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </li>
  );
}

export function Collection({ entries, categories, onEdit, onAdvance }) {
  return (
    <ul className="posters">
      {entries.map((entry, index) => (
        <CollectionEntry key={entry.id} entry={entry} eager={index < 5}
          category={categories.find(({ id }) => id === entry.category)?.name}
          onEdit={onEdit} onAdvance={onAdvance} />
      ))}
    </ul>
  );
}
