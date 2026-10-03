'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

/*
 * Small data-fetching hook.
 *   const { data, meta, loading, error, refetch } = useFetch('/leaves/my', { params: { year } });
 * Pass url = null to skip fetching.
 */
export function useFetch(url, { params } = {}) {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState(null);

  // Stringify params so a new object with the same values doesn't trigger a refetch
  const paramsKey = JSON.stringify(params || {});

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params: JSON.parse(paramsKey) });
      setData(res.data);
      setMeta(res.meta || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url, paramsKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, meta, loading, error, refetch: fetchData, setData };
}
