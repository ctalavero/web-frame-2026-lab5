import { useEffect, useRef, useState } from 'react';
import { BarChart3, Bookmark, Check, ChevronDown, Clapperboard, Dices, Film, Grid2X2, Layers3, Plus, Search, Shapes, Sparkles, Tv, Video } from 'lucide-react';
import { CategoryEditor, Dialog, EntryEditor } from './Editors';
import { Collection, Suggestion } from './LibraryViews';
import { TierBoard } from './TierBoard';
import { Statistics } from './Statistics';
import { TierExport } from './TierExport';
import { isLibrary, pickEntries, statuses } from './library';
import { libraryApi } from './libraryApi';

const categoryIcons = { film: Film, tv: Tv, animation: Sparkles, doc: Video };
const pluralRules = new Intl.PluralRules('uk');

function entryCount(count) {
  const form = pluralRules.select(count);
  return `${count} ${{ one: 'запис', few: 'записи' }[form] ?? 'записів'}`;
}

function Sidebar({ library, view, category, onView, onCategory, onAddCategory, onAddEntry, mobileAddButton }) {
  const categories = library?.categories ?? [];

  return (
    <aside className="sidebar">
      <button type="button" className="brand" onClick={() => onView('collection', true)}>
        <span className="brand-icon"><Clapperboard size={20} strokeWidth={2} aria-hidden="true" /></span>
        <span>Після титрів</span>
      </button>

      <nav className="view-nav" aria-label="Режим перегляду">
        <button type="button" aria-pressed={view === 'collection'} onClick={() => onView('collection')}>
          <Grid2X2 size={18} aria-hidden="true" /> Колекція
        </button>
        <button ref={mobileAddButton} type="button" className="mobile-add" aria-label="Додати запис"
          disabled={!library} onClick={onAddEntry}>
          <span className="mobile-add-icon"><Plus size={19} aria-hidden="true" /></span> Додати
        </button>
        <button type="button" aria-pressed={view === 'tiers'} onClick={() => onView('tiers')}>
          <Layers3 size={18} aria-hidden="true" /> Тірліст
        </button>
        <button type="button" aria-pressed={view === 'stats'} onClick={() => onView('stats')}>
          <BarChart3 size={18} aria-hidden="true" /> Статистика
        </button>
      </nav>

      {view === 'collection' && <section className="category-menu" aria-labelledby="category-title">
        <div className="category-heading">
          <h2 id="category-title">Категорії</h2>
          <button type="button" className="icon-button category-add" aria-label="Додати категорію"
            disabled={!library} onClick={onAddCategory}><Plus size={17} aria-hidden="true" /></button>
        </div>
        <div className="category-options" role="group" aria-label="Фільтр категорій">
          <button type="button" aria-pressed={!category} onClick={() => onCategory('')}>
            <Shapes size={17} aria-hidden="true" /> <span>Усе</span>
            {library && <small>{library.entries.length}</small>}
          </button>
          {categories.map((item) => {
            const Icon = categoryIcons[item.id] ?? Shapes;
            return (
              <button type="button" key={item.id} aria-pressed={category === item.id} onClick={() => onCategory(item.id)}>
                <Icon size={17} aria-hidden="true" /> <span>{item.name}</span>
                <small>{library.entries.filter((entry) => entry.category === item.id).length}</small>
              </button>
            );
          })}
        </div>
      </section>}
    </aside>
  );
}

function Hero({ entries, planned, onPick }) {
  const watched = entries.filter((entry) => entry.status === 'watched').length;
  return (
    <header className="hero" data-enter>
      <img className="hero-art" src="/art/hero.webp" alt="" fetchPriority="high" />
      <div className="hero-content">
        <h1>Моя колекція</h1>
        <p>Збирай перегляди, став оцінки й вирішуй, що дивитися далі.</p>
        <ul className="hero-stats" aria-label="Статистика колекції">
          <li><Film size={16} aria-hidden="true" />{entryCount(entries.length)}</li>
          <li><Check size={16} aria-hidden="true" />{watched} переглянуто</li>
          <li><Bookmark size={15} aria-hidden="true" />{planned} у планах</li>
        </ul>
        {planned > 0 && <button type="button" className="button secondary hero-pick" onClick={() => onPick()}>
          <Dices size={17} aria-hidden="true" /> Що подивитися?
        </button>}
      </div>
    </header>
  );
}

export default function App() {
  const [library, setLibrary] = useState(null);
  const [fetchError, setFetchError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState('collection');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [editor, setEditor] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const addButton = useRef(null);
  const mobileAddButton = useRef(null);
  const resultsHeading = useRef(null);

  useEffect(() => {
    const request = new AbortController();
    async function loadLibrary() {
      try {
        const data = await libraryApi.read(request.signal);
        if (!isLibrary(data)) throw new Error('Сервер повернув невідому структуру колекції.');
        if (!request.signal.aborted) setLibrary(data);
      } catch (error) {
        if (!request.signal.aborted) setFetchError(error.message);
      }
    }
    loadLibrary();
    return () => request.abort();
  }, [attempt]);

  const resetFilters = () => {
    setCategory('');
    setStatus('');
    setQuery('');
  };

  const changeView = (nextView, reset) => {
    setView(nextView);
    if (reset) resetFilters();
    if (nextView !== view || reset) window.scrollTo({ top: 0 });
  };

  const replaceEntry = (entry) => {
    setLibrary((current) => ({
      ...current,
      entries: current.entries.map((item) => item.id === entry.id && item.revision <= entry.revision ? entry : item),
    }));
  };

  const removeEntry = (id) => setLibrary((current) => ({
    ...current, entries: current.entries.filter((entry) => entry.id !== id),
  }));

  const changeEntry = async (id, action) => {
    try {
      return await action();
    } catch (error) {
      if (error.code === 'ENTRY_NOT_FOUND') removeEntry(id);
      if (error.code === 'STALE_ENTRY') {
        try {
          replaceEntry(await libraryApi.entry(id));
        } catch (refreshError) {
          if (refreshError.code === 'ENTRY_NOT_FOUND') removeEntry(id);
        }
      }
      throw error;
    }
  };

  const saveEntry = async (draft) => {
    const entry = await changeEntry(draft.id, () => libraryApi.save(draft));
    if (!draft.id) {
      setLibrary((current) => ({ ...current, entries: [entry, ...current.entries] }));
      changeView('collection');
      setCategory(entry.category);
      setStatus('');
      setQuery('');
      setSort('recent');
    } else replaceEntry(entry);
    setAnnouncement(draft.id ? 'Запис оновлено.' : 'Запис додано.');
  };

  const deleteEntry = async (entry) => {
    await changeEntry(entry.id, () => libraryApi.delete(entry));
    removeEntry(entry.id);
    setAnnouncement('Запис видалено.');
    requestAnimationFrame(() => {
      const visibleButton = mobileAddButton.current?.getClientRects().length ? mobileAddButton.current : addButton.current;
      visibleButton?.focus();
    });
  };

  const addCategory = async (name) => {
    const added = await libraryApi.addCategory(name);
    setLibrary((current) => ({ ...current, categories: [...current.categories, added] }));
    changeView('collection');
    setCategory(added.id);
    setStatus('');
    setQuery('');
    setAnnouncement('Категорію створено.');
  };

  const entries = library?.entries ?? [];
  const planned = entries.filter((entry) => entry.status === 'planned');
  const filters = { category, status, query, sort };
  const selectedEntries = pickEntries(entries, filters);
  const selectedCategory = library?.categories.find((item) => item.id === category);
  const emptyCategory = selectedCategory && !entries.some((entry) => entry.category === category);
  const hasFilters = Boolean(category || status || query.trim());
  const editEntry = (entry) => setEditor({ type: 'entry', entry });
  const openNew = () => setEditor({ type: 'entry', entry: null });
  const suggestEntry = () => setEditor({ type: 'suggestion' });

  const startWatching = async (entry) => {
    replaceEntry(await changeEntry(entry.id, () => libraryApi.save({ ...entry, status: 'watching' })));
    setAnnouncement(`«${entry.title}» перенесено до «Дивлюсь».`);
    if (planned.length === 1) requestAnimationFrame(() => resultsHeading.current?.focus());
  };

  const advanceEpisode = async (entry) => {
    const updated = await changeEntry(entry.id, () => libraryApi.advance(entry));
    replaceEntry(updated);
    setAnnouncement(updated.status === 'watched' ? `«${entry.title}» переглянуто.`
      : `Позначено епізод ${updated.watchedEpisodes} із ${updated.totalEpisodes}.`);
    return updated;
  };

  const moveTier = async (entry, tier) => {
    const updated = await changeEntry(entry.id, () => libraryApi.setTier(entry, tier));
    replaceEntry(updated);
    setAnnouncement(`«${entry.title}» переміщено до «${tier || 'Без рівня'}».`);
  };

  return (
    <div className="app">
      <a className="skip-link" href="#main">До вмісту</a>
      <Sidebar library={library} view={view} category={category} onView={changeView}
        onCategory={setCategory} onAddCategory={() => setEditor({ type: 'category' })}
        onAddEntry={openNew} mobileAddButton={mobileAddButton} />

      <main id="main" className="main" tabIndex={-1}>
        <div className="main-inner">
          {view !== 'stats' && <div className="top-bar">
            <label className="search">
              <Search size={19} aria-hidden="true" />
              <input type="search" aria-label="Пошук за назвою" placeholder="Пошук"
                maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <button ref={addButton} type="button" className="button primary" disabled={!library} onClick={openNew}>
              <Plus size={19} aria-hidden="true" /> <span>Додати запис</span>
            </button>
          </div>}

          {view === 'collection' && <Hero entries={entries} planned={planned.length} onPick={suggestEntry} />}
          {view === 'tiers' && <header className="board-heading tier-heading">
            <h1>Мій тірліст</h1>
            <TierExport filters={filters} disabled={!selectedEntries.length} />
          </header>}

          {view === 'stats' ? <Statistics /> : !library ? (
            fetchError
              ? <div className="message error-panel">
                  <p role="alert">{fetchError}</p>
                  <div className="message-actions">
                    <button type="button" className="button primary" onClick={() => {
                      setFetchError('');
                      setAttempt((value) => value + 1);
                    }}>Повторити</button>
                  </div>
                </div>
              : <p className="message" role="status">Завантажуємо колекцію…</p>
          ) : (
            <section className="results" aria-labelledby="results-title">
              <div className="results-header">
                <h2 ref={resultsHeading} id="results-title" tabIndex={-1}>{selectedCategory?.name ?? 'Усі записи'}</h2>
                <span className="result-count" aria-live="polite">{entryCount(selectedEntries.length)}</span>
              </div>
              <div className="filters">
                <div className="status-filters" role="group" aria-label="Статус перегляду">
                  {[['', 'Усі'], ...statuses].map(([id, label]) => (
                    <button type="button" key={id} aria-pressed={status === id} onClick={() => setStatus(id)}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="filter-selects">
                  {view === 'tiers' && <label className="sort">
                    <span className="sr-only">Категорія тірліста</span>
                    <select value={category} onChange={(event) => setCategory(event.target.value)}>
                      <option value="">Усі категорії</option>
                      {library.categories.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                    </select>
                    <ChevronDown size={15} aria-hidden="true" />
                  </label>}
                  <label className="sort">
                    <span className="sr-only">Сортування</span>
                    <select value={sort} onChange={(event) => setSort(event.target.value)}>
                      <option value="recent">Останні додані</option>
                      <option value="score">Найвищий бал</option>
                      <option value="title">За назвою</option>
                    </select>
                    <ChevronDown size={15} aria-hidden="true" />
                  </label>
                </div>
              </div>

              {selectedEntries.length
                ? view === 'collection'
                  ? <Collection entries={selectedEntries} categories={library.categories} onEdit={editEntry} onAdvance={advanceEpisode} />
                  : <TierBoard entries={selectedEntries} onEdit={editEntry} onTierChange={moveTier} />
                : <div className="empty-state">
                    <Film size={25} strokeWidth={1.5} aria-hidden="true" />
                    <h3>{emptyCategory ? 'Категорія поки порожня' : hasFilters ? 'Записів не знайдено' : 'Колекція поки порожня'}</h3>
                    {hasFilters && !emptyCategory
                      ? <button type="button" className="button secondary" onClick={resetFilters}>Скинути фільтри</button>
                      : <button type="button" className="button secondary" onClick={openNew}>Додати перший запис</button>}
                  </div>}
            </section>
          )}
        </div>
      </main>

      <div className="sr-only" role="status">{announcement}</div>
      {editor?.type === 'suggestion' && (
        <Dialog title="Пропозиція з планів" onDismiss={() => setEditor(null)}>
          {({ run, busy, actionError }) => <Suggestion categories={library.categories}
            canShuffle={planned.length > 1} busy={busy} actionError={actionError}
            onShuffle={(load) => run(load, false)}
            onStart={(entry) => run(() => startWatching(entry))} />}
        </Dialog>
      )}
      {editor && editor.type !== 'suggestion' && (
        <Dialog title={editor.type === 'category' ? 'Нова категорія' : editor.entry ? 'Редагування запису' : 'Новий запис'}
          onDismiss={() => setEditor(null)}>
          {({ dismiss, run, busy, actionError }) => editor.type === 'category'
            ? <CategoryEditor categories={library.categories} onCancel={dismiss} busy={busy} actionError={actionError}
                onSave={(name) => run(() => addCategory(name))} />
            : <EntryEditor entry={editor.entry} category={category} categories={library.categories} onCancel={dismiss}
                busy={busy} actionError={actionError} onSave={(entry) => run(() => saveEntry(entry))}
                onDelete={() => run(() => deleteEntry(editor.entry))} />}
        </Dialog>
      )}
    </div>
  );
}
