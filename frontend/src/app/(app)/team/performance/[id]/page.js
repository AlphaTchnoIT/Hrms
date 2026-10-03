'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { History, Plus } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import { AUDITOR_ROLES } from '@/lib/constants';
import { useAuth } from '@/context/AuthContext';
import { getFullName } from '@/lib/format';
import { Button, Card, ErrorMessage, PageHeader, PageLoader } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';
import PerformanceDashboard from '@/components/performance/PerformanceDashboard';
import ActionPlanCard from '@/components/performance/ActionPlanCard';
import { ActionPlanFormModal, CheckInModal } from '@/components/performance/ActionPlanModals';

export default function EmployeePerformancePage() {
  const { id } = useParams();
  const { isApprover } = useAuth();
  const { data, loading, error, refetch } = useFetch(`/performance/employee/${id}`);
  const [editing, setEditing] = useState(undefined);
  const [checkIn, setCheckIn] = useState(null);
  const name = getFullName(data?.user);

  return (
    <RoleGuard roles={AUDITOR_ROLES}>
      <PageHeader
        title={data ? name : 'Employee performance'}
        subtitle="Current and historical KPI performance"
        back={{ href: '/team/performance', label: 'Team performance' }}
        actions={
          isApprover && (
            <>
              <Link href={`/relations?tab=history&employee=${id}`}>
                <Button variant="secondary" icon={History}>
                  Relations history
                </Button>
              </Link>
              <Button icon={Plus} onClick={() => setEditing(null)}>
                Action plan
              </Button>
            </>
          )
        }
      />
      <ErrorMessage message={error} onRetry={refetch} />
      {loading && !data && <PageLoader />}
      {data && (
        <div className="space-y-6">
          <PerformanceDashboard data={data} mode="manager" onRefetch={refetch} />
          {data.actionPlans.length > 0 && (
            <Card title="Action plans" subtitle="Forward performance since each plan started">
              <div className="grid gap-4 lg:grid-cols-2">
                {data.actionPlans.map((plan) => (
                  <ActionPlanCard key={plan._id} plan={plan} mode={isApprover ? 'manager' : 'view'} onChanged={refetch} onEdit={setEditing} onCheckIn={setCheckIn} />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <ActionPlanFormModal
        open={editing !== undefined}
        plan={editing}
        defaultUser={id}
        memberOptions={data ? [{ value: id, label: name }] : []}
        onClose={() => setEditing(undefined)}
        onSaved={refetch}
      />
      <CheckInModal open={Boolean(checkIn)} plan={checkIn} onClose={() => setCheckIn(null)} onSaved={refetch} />
    </RoleGuard>
  );
}
