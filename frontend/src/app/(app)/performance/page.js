'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Target } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { Button, EmptyState, PageHeader, PageLoader, StatCard, useConfirm } from '@/components/ui';
import GoalCard from '@/components/performance/GoalCard';
import GoalFormModal from '@/components/performance/GoalFormModal';

export default function PerformancePage() {
  const confirm = useConfirm();
  const { data: goals, loading, refetch } = useFetch('/goals/my');
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new goal

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

  const list = goals || [];
  const completed = list.filter((g) => g.status === 'completed').length;
  const avgProgress = list.length ? Math.round(list.reduce((s, g) => s + g.progress, 0) / list.length) : 0;

  return (
    <div>
      <PageHeader
        title="My Goals"
        subtitle="Track your objectives and self-review"
        actions={
          <Button icon={Plus} onClick={() => setEditing(null)}>
            Add goal
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total goals" value={list.length} icon={Target} />
        <StatCard label="Completed" value={completed} icon={Target} tone="green" />
        <StatCard label="Average progress" value={`${avgProgress}%`} icon={Target} tone="blue" />
      </div>

      {loading && !goals && <PageLoader />}
      {!loading && !list.length && <EmptyState icon={Target} message="No goals yet. Add your first goal!" />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((goal) => (
          <GoalCard
            key={goal._id}
            goal={goal}
            onEdit={setEditing}
            onDelete={String(goal.createdBy?._id) === String(goal.user?._id) ? deleteGoal : undefined}
          />
        ))}
      </div>

      <GoalFormModal open={editing !== undefined} goal={editing} mode="self" onClose={() => setEditing(undefined)} onSaved={refetch} />
    </div>
  );
}
