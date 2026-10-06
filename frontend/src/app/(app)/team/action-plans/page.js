'use client';

import { useState } from 'react';
import { ListChecks, Plus } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { APPROVER_ROLES } from '@/lib/constants';
import { Button, EmptyState, ErrorMessage, PageHeader, PageLoader, Select, Tabs } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';
import { useTeamScope } from '@/hooks/useTeamScope';
import TeamScopeToggle from '@/components/shared/TeamScopeToggle';
import ActionPlanCard from '@/components/performance/ActionPlanCard';
import { ActionPlanFormModal, CheckInModal } from '@/components/performance/ActionPlanModals';

const TABS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
  { value: '', label: 'All' },
];

export default function TeamActionPlansPage() {
  const [status, setStatus] = useState('active');
  const [member, setMember] = useState('');
  const [editing, setEditing] = useState(undefined);
  const [checkIn, setCheckIn] = useState(null);
  const { options } = useTeamMembers();
  const teamScope = useTeamScope();
  const { data, loading, error, refetch } = useFetch('/action-plans', {
    params: { user: member || undefined, status: status === 'active' || !status ? undefined : status, scope: teamScope.scope },
  });
  const plans = (data || []).filter((p) => status !== 'active' || ['open', 'in-progress'].includes(p.status));

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader
        title="Action Plans"
        subtitle="Targeted improvement plans with actions, deadlines, follow-ups and forward performance"
        actions={
          <Button icon={Plus} onClick={() => setEditing(null)}>
            New action plan
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs tabs={TABS} value={status} onChange={setStatus} />
        <Select className="w-64" placeholder="All employees" options={options} value={member} onChange={(e) => setMember(e.target.value)} />
        <TeamScopeToggle {...teamScope} />
      </div>

      <ErrorMessage message={error} onRetry={refetch} />
      {loading && !data && <PageLoader />}
      {!loading && !plans.length && <EmptyState icon={ListChecks} message="No action plans here. Use “Generate from KPIs” to create one for an employee below target." />}
      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => (
          <ActionPlanCard key={plan._id} plan={plan} mode="manager" onChanged={refetch} onEdit={setEditing} onCheckIn={setCheckIn} />
        ))}
      </div>

      <ActionPlanFormModal open={editing !== undefined} plan={editing} memberOptions={options} onClose={() => setEditing(undefined)} onSaved={refetch} />
      <CheckInModal open={Boolean(checkIn)} plan={checkIn} onClose={() => setCheckIn(null)} onSaved={refetch} />
    </RoleGuard>
  );
}
