'use client';

import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getFullName } from '@/lib/format';
import { useFetch } from './useFetch';

/*
 * Employees the logged-in user can act on:
 * HR / admin / QA -> everyone (directory), manager -> direct reports.
 *   const { members, options, loading } = useTeamMembers();
 */
export function useTeamMembers() {
  const { user, isHR, isQA } = useAuth();
  const everyone = isHR || isQA;
  const { data, loading } = useFetch(user ? (everyone ? '/employees/directory' : '/employees/team') : null, {
    params: everyone ? { limit: 200 } : undefined,
  });
  const members = useMemo(() => data || [], [data]);
  const options = useMemo(() => members.map((m) => ({ value: m._id, label: `${getFullName(m)}${m.employeeCode ? ` (${m.employeeCode})` : ''}` })), [members]);
  return { members, options, loading };
}
