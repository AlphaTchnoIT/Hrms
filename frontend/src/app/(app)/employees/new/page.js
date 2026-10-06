'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { HR_ROLES } from '@/lib/constants';
import { Button, Modal, PageHeader } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';
import EmployeeForm, { toFormValues } from '@/components/employees/EmployeeForm';

export default function NewEmployeePage() {
  const router = useRouter();
  const [created, setCreated] = useState(null);

  // Errors are thrown back to the form so they show on the right fields
  const handleSubmit = async (payload) => {
    const res = await api.post('/employees', payload);
    toast.success(res.message);
    // A generated one-time password is shown once so HR can pass it on
    if (res.data.temporaryPassword) setCreated(res.data);
    else router.push(`/employees/${res.data._id}`);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.temporaryPassword);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed, please select the password');
    }
  };

  return (
    <RoleGuard roles={HR_ROLES}>
      <PageHeader
        title="Add employee"
        subtitle="An employee code is generated automatically."
        back={{ href: '/employees', label: 'All employees' }}
      />
      <EmployeeForm initialValues={toFormValues()} onSubmit={handleSubmit} onCancel={() => router.push('/employees')} />
      <Modal
        open={Boolean(created)}
        onClose={() => router.push(`/employees/${created._id}`)}
        title="Account created"
        description={created ? `${created.firstName}'s one-time password. It is shown only now.` : ''}
        footer={<Button onClick={() => router.push(`/employees/${created._id}`)}>Done</Button>}
      >
        {created && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <KeyRound className="h-4 w-4 text-slate-400" />
              <code className="flex-1 text-base font-semibold text-slate-900">{created.temporaryPassword}</code>
              <Button size="xs" variant="secondary" icon={Copy} onClick={copy}>
                Copy
              </Button>
            </div>
            <p className="text-sm text-slate-600">
              Share it with {created.firstName} privately (not by email with their username). They will be asked to choose their own password at first login.
            </p>
          </div>
        )}
      </Modal>
    </RoleGuard>
  );
}
