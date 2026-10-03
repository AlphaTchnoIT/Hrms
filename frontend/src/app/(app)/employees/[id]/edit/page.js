'use client';

import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { HR_ROLES } from '@/lib/constants';
import { getFullName } from '@/lib/format';
import { ErrorMessage, PageHeader, PageLoader } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';
import EmployeeForm, { toFormValues } from '@/components/employees/EmployeeForm';

export default function EditEmployeePage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: employee, loading, error } = useFetch(`/employees/${id}`);

  const handleSubmit = async (payload) => {
    const res = await api.put(`/employees/${id}`, payload);
    toast.success(res.message);
    router.push(`/employees/${id}`);
  };

  return (
    <RoleGuard roles={HR_ROLES}>
      {loading && <PageLoader />}
      <ErrorMessage message={error} />
      {employee && (
        <>
          <PageHeader
            title={`Edit ${getFullName(employee)}`}
            subtitle={employee.employeeCode}
            back={{ href: `/employees/${id}`, label: 'Back to profile' }}
          />
          <EmployeeForm
            isEdit
            employeeId={id}
            initialValues={toFormValues(employee)}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/employees/${id}`)}
          />
        </>
      )}
    </RoleGuard>
  );
}
