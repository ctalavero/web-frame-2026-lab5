import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { libraryApi } from './libraryApi';

export function TierExport({ filters, disabled }) {
  const [format, setFormat] = useState('png');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const pending = useRef(false);

  async function download() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setComplete(false);
    setError('');
    try {
      const image = await libraryApi.exportTiers({ ...filters, format });
      const url = URL.createObjectURL(image);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pislia-tytriv-tier-list.' + (format === 'jpeg' ? 'jpg' : 'png');
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setComplete(true);
    } catch (failure) {
      setError(failure.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="tier-export">
      <div className="tier-export-controls">
        <select aria-label="Формат зображення" value={format} disabled={busy} onChange={(event) => setFormat(event.target.value)}>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
        </select>
        <button type="button" className="button secondary" onClick={download} disabled={disabled || busy}>
          <Download size={17} aria-hidden="true" /> {busy ? 'Готуємо…' : 'Зберегти файл'}
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <span className="sr-only" role="status">{complete ? 'Зображення готове.' : ''}</span>
    </div>
  );
}
