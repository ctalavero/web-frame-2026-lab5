import { statuses } from './library';
import { libraryApi } from './libraryApi';
import { useApiResource } from './useApiResource';

const number = new Intl.NumberFormat('uk', { maximumFractionDigits: 2 });

export function Statistics() {
  const { data, error, retry } = useApiResource(libraryApi.stats);
  const metrics = data && [
    ['Записів у колекції', number.format(data.total)],
    ['Переглянутих епізодів', number.format(data.watchedEpisodes)],
    ['Середній бал', data.averageScore === null ? '—' : `${number.format(data.averageScore)} / 10`],
  ];

  return (
    <section className="statistics" aria-labelledby="stats-heading">
      <header className="board-heading"><h1 id="stats-heading">Статистика</h1></header>
      {error ? <div className="message error-panel">
        <p role="alert">{error.message}</p>
        <div className="message-actions"><button type="button" className="button secondary" onClick={retry}>Повторити</button></div>
      </div> : !data ? <p className="message" role="status">Завантажуємо статистику…</p> : <>
        <dl className="stat-metrics">
          {metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        <section className="status-summary" aria-labelledby="status-heading">
          <h2 id="status-heading">Статуси перегляду</h2>
          <ul>
            {statuses.map(([key, label]) => <li key={key}>
              <div><span>{label}</span><strong>{number.format(data[key])}</strong></div>
              <meter min="0" max={data.total || 1} value={data[key]} aria-label={label} />
            </li>)}
          </ul>
        </section>
      </>}
    </section>
  );
}
