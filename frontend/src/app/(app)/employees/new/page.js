'use client';

import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { HR_ROLES } from '@/lib/constants';
import { PageHeader } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';
import EmployeeForm, { toFormValues } from '@/components/employees/EmployeeForm';

export default function NewEmployeePage() {
  const router = useRouter();

  // Errors are thrown back to the form so they show on the right fields
  const handleSubmit = async (payload) => {
    const res = await api.post('/employees', payload);
    toast.success(res.message);
    router.push(`/employees/${res.data._id}`);
  };

  return (
    <RoleGuard roles={HR_ROLES}>
      <PageHeader
        title="Add employee"
        subtitle="An employee code is generated automatically."
        back={{ href: '/employees', label: 'All employees' }}
      />
      <EmployeeForm initialValues={toFormValues()} onSubmit={handleSubmit} onCancel={() => router.push('/employees')} />
    </RoleGuard>
  );
}
