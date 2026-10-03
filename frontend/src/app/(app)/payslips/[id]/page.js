'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Printer } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import { Button, ErrorMessage, PageLoader } from '@/components/ui';
import PayslipView from '@/components/payroll/PayslipView';

export default function PayslipPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, loading, error } = useFetch(`/payroll/payslips/${id}`);

  if (loading) return <PageLoader />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div>
      <div className="no-print mb-4 flex justify-between">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => router.back()}>
          Back
        </Button>
        <Button icon={Printer} onClick={() => window.print()}>
          Print / Save PDF
        </Button>
      </div>
      <PayslipView payslip={data.payslip} company={data.company} />
    </div>
  );
}
