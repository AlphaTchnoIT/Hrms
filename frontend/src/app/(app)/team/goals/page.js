'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Target } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { APPROVER_ROLES, GOAL_STATUS } from '@/lib/constants';
import { getFullName } from '@/lib/format';
import { Button, EmptyState, PageHeader, PageLoader, Select, useConfirm } from '@/components/ui';
import GoalCard from '@/components/performance/GoalCard';
import GoalFormModal from '@/components/performance/GoalFormModal';
import RoleGuard from '@/components/layout/RoleGuard';

export default function TeamGoalsPage() {
  const confirm = useConfirm();
  const { isHR } = useAuth();
  const [member, setMember] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(undefined);

  // HR can assign goals to anyone, managers to their direct reports
  const people = useFetch(isHR ? '/employees/directory' : '/employees/team', { params: isHR ? { limit: 200 } : undefined });
  const { data: goals, loading, refetch } = useFetch('/goals', {
    params: { user: member || undefined, status: status || undefined },
  });

  const deleteGoal = async (goal) => {
    const ok = await confirm({ title: 'Delete this goal?', message: `"${goal.title}" will be permanently removed.`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/goals/${goal._id}`);
      toast.success('Goal deleted');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <RoleGuard roles={APPROVER_ROLES}>
      <PageHeader
        title="Team Goals"
        subtitle="Assign goals and review your team's performance"
        actions={
          <Button icon={Plus} onClick={() => setEditing(null)}>
            Assign goal
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select
          className="w-56"
          placeholder="All employees"
          options={(people.data || []).map((p) => ({ value: p._id, label: getFullName(p) }))}
          value={member}
          onChange={(e) => setMember(e.target.value)}
        />
        <Select className="w-48" placeholder="All statuses" options={GOAL_STATUS} value={status} onChange={(e) => setStatus(e.target.value)} />
      </div>

      {loading && !goals && <PageLoader />}
      {!loading && !goals?.length && <EmptyState icon={Target} message="No goals found" />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(goals || []).map((goal) => (
          <GoalCard key={goal._id} goal={goal} showOwner onEdit={setEditing} onDelete={deleteGoal} />
        ))}
      </div>

      <GoalFormModal
        open={editing !== undefined}
        goal={editing}
        mode="manager"
        teamMembers={people.data || []}
        onClose={() => setEditing(undefined)}
        onSaved={refetch}
      />
    </RoleGuard>
  );
}
