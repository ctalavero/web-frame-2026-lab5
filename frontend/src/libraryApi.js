const base = (process.env.REACT_APP_API_URL ?? '').replace(/\/$/, '');

async function request(path, { method = 'GET', body, signal, imageType } = {}) {
  const timeout = AbortSignal.timeout(12000);
  let response;
  try {
    response = await fetch(base + '/api' + path, {
      method,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Не вдалося зв’язатися із сервером. Спробуй ще раз.');
  }
  if (response.status === 204) return undefined;
  if (response.ok && imageType && response.headers.get('content-type') === imageType) return response.blob();
  const data = await response.json().catch(() => null);
  if (!response.ok || data === null || imageType) {
    const error = new Error(data?.error?.message ?? 'Сервер не зміг виконати запит. Спробуй ще раз.');
    error.code = data?.error?.code;
    throw error;
  }
  return data;
}

export const libraryApi = {
  read: (signal) => request('/library', { signal }),
  entry: (id) => request('/entries/' + id),
  stats: (signal) => request('/stats', { signal }),
  suggest: (exclude, signal) => request('/suggestion' + (exclude ? '?exclude=' + encodeURIComponent(exclude) : ''), { signal }),
  addCategory: (name) => request('/categories', { method: 'POST', body: { name } }),
  save: ({ id, ...body }) => id ? request('/entries/' + id, { method: 'PUT', body })
    : request('/entries', { method: 'POST', body }),
  delete: ({ id, revision }) => request('/entries/' + id + '?revision=' + revision, { method: 'DELETE' }),
  advance: ({ id, revision }) => request('/entries/' + id + '/progress', { method: 'PATCH', body: { revision } }),
  setTier: ({ id, revision }, tier) => request('/entries/' + id + '/tier', { method: 'PATCH', body: { revision, tier } }),
  exportTiers: ({ category, status, query, sort, format }) => {
    const params = new URLSearchParams({ format, sort });
    if (category) params.set('category', category);
    if (status) params.set('status', status);
    if (query.trim()) params.set('q', query.trim());
    return request('/tier-list/export?' + params, { imageType: 'image/' + format });
  },
};
