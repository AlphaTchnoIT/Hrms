'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const STORAGE_KEY = 'team-scope';

/*
 * "Direct reportees" vs "All reportees" (the whole chain under a manager, e.g. team leads' teams too).
 * The choice is remembered across team pages.
 *   const { scope, setScope, canToggle } = useTeamScope({ manager });
 *   useFetch('/leaves', { params: { scope } });
 * canToggle: the user has indirect reportees, or HR picked a manager whose team has team leads.
 */
export function useTeamScope({ manager } = {}) {
  const { isHR, team } = useAuth();
  const [scope, setScopeState] = useState('direct');

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === 'all') setScopeState('all');
    } catch {
      // storage blocked: keep the default
    }
  }, []);

  const setScope = (value) => {
    setScopeState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // storage blocked: the choice just isn't remembered
    }
  };

  const canToggle = isHR ? Boolean(manager) : team.all > team.direct;
  return { scope: canToggle ? scope : 'direct', setScope, canToggle };
}
