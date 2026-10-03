'use client';

import { useEffect, useState } from 'react';

/*
 * Tab state that can be opened from a link like /performance?tab=action-plans
 * (notifications use these links). Reads the URL once on mount.
 */
export function useTabParam(defaultTab, allowed = []) {
  const [tab, setTab] = useState(defaultTab);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (fromUrl && (!allowed.length || allowed.includes(fromUrl))) setTab(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [tab, setTab];
}

// Reads one query string value once on mount (e.g. ?ticket=<id>)
export function useQueryValue(name) {
  const [value, setValue] = useState(null);
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return value;
}
