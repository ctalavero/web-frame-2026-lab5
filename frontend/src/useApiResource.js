import { useEffect, useState } from 'react';

export function useApiResource(read) {
  const [resource, setResource] = useState({ data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    read(request.signal).then(
      (data) => { if (!request.signal.aborted) setResource({ data, error: null }); },
      (error) => { if (!request.signal.aborted) setResource({ data: null, error }); },
    );
    return () => request.abort();
  }, [read, attempt]);

  return {
    ...resource,
    setData: (data) => setResource({ data, error: null }),
    retry: () => {
      setResource({ data: null, error: null });
      setAttempt((count) => count + 1);
    },
  };
}
