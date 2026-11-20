import { useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export function SeasonFields({ seasons, onAdd, onRemove, onChange }) {
  const addButton = useRef(null);
  return (
    <fieldset className="episode-fields season-fields">
      <legend>Сезони</legend>
      {seasons.map((season, index) => (
        <fieldset className="season-row" key={index}>
          <legend>Сезон {index + 1}</legend>
          <div className="season-row-body">
            <div className="field-pair">
              <label className="field">Епізодів
                <input type="number" min={1} max={10000} step={1} inputMode="numeric" required
                  aria-label={`Епізодів у сезоні ${index + 1}`} value={season.totalEpisodes ?? ''}
                  onChange={(event) => onChange(index, 'totalEpisodes', event.target.value)} />
              </label>
              <label className="field">Переглянуто
                <input type="number" min={0} max={season.totalEpisodes ?? 0} step={1} inputMode="numeric"
                  aria-label={`Переглянуто в сезоні ${index + 1}`} disabled={!season.totalEpisodes}
                  value={season.watchedEpisodes || ''} placeholder="0"
                  onChange={(event) => onChange(index, 'watchedEpisodes', event.target.value)} />
              </label>
            </div>
            {index === seasons.length - 1 && (
              <button type="button" className="icon-button" aria-label={`Прибрати сезон ${index + 1}`}
                onClick={() => {
                  onRemove();
                  requestAnimationFrame(() => addButton.current?.focus());
                }}><Trash2 size={17} aria-hidden="true" /></button>
            )}
          </div>
        </fieldset>
      ))}
      <button ref={addButton} type="button" className="button secondary season-add" disabled={seasons.length >= 50} onClick={onAdd}>
        <Plus size={17} aria-hidden="true" /> Додати сезон
      </button>
    </fieldset>
  );
}
