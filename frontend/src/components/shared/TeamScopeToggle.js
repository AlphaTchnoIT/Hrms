'use client';

import { Tabs } from '@/components/ui';

const OPTIONS = [
  { value: 'direct', label: 'Direct reportees' },
  { value: 'all', label: 'All reportees' },
];

// Direct / All reportees switch for team pages (see useTeamScope). Hidden when there is nothing to switch.
export default function TeamScopeToggle({ scope, setScope, canToggle }) {
  if (!canToggle) return null;
  return <Tabs tabs={OPTIONS} value={scope} onChange={setScope} />;
}
