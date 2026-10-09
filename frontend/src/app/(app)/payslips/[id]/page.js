'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, PencilLine, Printer } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { Button, ErrorMessage, PageLoader } from '@/components/ui';
import PayslipView from '@/components/payroll/PayslipView';
import ManualItemsModal from '@/components/payroll/ManualItemsModal';

export default function PayslipPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isHR } = useAuth();
  const [editing, setEditing] = useState(false);
  const { data, loading, error, refetch } = useFetch(`/payroll/payslips/${id}`);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div>
      <div className="no-print mb-4 flex justify-between">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.back()}>
          Back
        </Button>
        <div className="flex gap-2">
          {isHR && data.payslip.status !== 'paid' && (
            <Button variant="secondary" icon={PencilLine} onClick={() => setEditing(true)}>
              Add / edit items
            </Button>
          )}
          <Button icon={Printer} onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        </div>
      </div>
      <PayslipView payslip={data.payslip} company={data.company} />
      {editing && <ManualItemsModal payslip={data.payslip} onClose={() => setEditing(false)} onSaved={refetch} />}
    </div>
  );
}
