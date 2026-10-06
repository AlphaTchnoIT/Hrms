'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Laptop, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { personalInfoSchema } from '@/lib/validation';
import { BLOOD_GROUPS, GENDERS, MARITAL_STATUS } from '@/lib/constants';
import { formatDate, titleCase, toInputDate } from '@/lib/format';
import { Badge, Button, Card, DataTable, FormSection, Input, Select, Tabs } from '@/components/ui';
import ProfileHeader from '@/components/employees/ProfileHeader';
import ProfileOverview from '@/components/employees/ProfileOverview';
import ChangePasswordForm from '@/components/auth/ChangePasswordForm';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'edit', label: 'Edit details' },
  { value: 'assets', label: 'My assets' },
  { value: 'security', label: 'Security' },
];

function EditPersonalInfo({ user, onSaved, onCancel }) {
  const form = useForm(
    {
      phone: user.phone || '',
      dateOfBirth: user.dateOfBirth ? toInputDate(user.dateOfBirth) : '',
      gender: user.gender || '',
      maritalStatus: user.maritalStatus || '',
      bloodGroup: user.bloodGroup || '',
      avatar: user.avatar || '',
      address: {
        line1: user.address?.line1 || '',
        line2: user.address?.line2 || '',
        city: user.address?.city || '',
        county: user.address?.county || '',
        country: user.address?.country || 'United Kingdom',
        postcode: user.address?.postcode || '',
      },
      emergencyContact: {
        name: user.emergencyContact?.name || '',
        relation: user.emergencyContact?.relation || '',
        phone: user.emergencyContact?.phone || '',
      },
    },
    { schema: personalInfoSchema }
  );
  const { register } = form;

  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.patch('/auth/me', { ...data, dateOfBirth: data.dateOfBirth || null });
    toast.success(res.message);
    onSaved(res.data);
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <FormSection title="Personal" description="Job details can only be changed by HR.">
          <Input label="Mobile number" placeholder="07700 900123" {...register('phone')} />
          <Input label="Date of birth" type="date" max={toInputDate()} {...register('dateOfBirth')} />
          <Select label="Gender" options={GENDERS} {...register('gender')} />
          <Select label="Marital status" options={MARITAL_STATUS} {...register('maritalStatus')} />
          <Select label="Blood group" options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))} {...register('bloodGroup')} />
          <Input label="Photo URL" placeholder="https://..." {...register('avatar')} />
        </FormSection>
        <FormSection title="Address" description="Your current residential address.">
          <Input label="Address line 1" className="sm:col-span-2" {...register('address.line1')} />
          <Input label="Address line 2" className="sm:col-span-2" {...register('address.line2')} />
          <Input label="Town / city" {...register('address.city')} />
          <Input label="County" {...register('address.county')} />
          <Input label="Postcode" placeholder="EC2A 4NE" maxLength={8} {...register('address.postcode')} />
          <Input label="Country" {...register('address.country')} />
        </FormSection>
        <FormSection title="Emergency contact" description="Who should we call in an emergency?">
          <Input label="Name" {...register('emergencyContact.name')} />
          <Input label="Relation" placeholder="e.g. Partner" {...register('emergencyContact.relation')} />
          <Input label="Phone" placeholder="07700 900123" {...register('emergencyContact.phone')} />
        </FormSection>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={form.submitting}>
            Save changes
          </Button>
        </div>
      </Card>
    </form>
  );
}

function ChangePassword() {
  return (
    <Card title="Change password" subtitle="Use at least 8 characters with a letter and a number. Other devices will be signed out." icon={ShieldCheck} className="max-w-lg">
      <ChangePasswordForm />
    </Card>
  );
}

function MyAssets() {
  const { data, loading } = useFetch('/assets/my');
  const columns = [
    { key: 'assetTag', header: 'Tag', render: (a) => <span className="font-mono text-xs">{a.assetTag}</span> },
    { key: 'name', header: 'Asset', render: (a) => <span className="font-medium text-slate-800">{a.name}</span> },
    { key: 'category', header: 'Category', render: (a) => titleCase(a.category) },
    { key: 'serialNumber', header: 'Serial no.' },
    { key: 'assignedDate', header: 'Assigned on', render: (a) => formatDate(a.assignedDate) },
    { key: 'status', header: 'Status', render: (a) => <Badge status={a.status} /> },
  ];
  return (
    <Card noPadding title="Assets assigned to me" icon={Laptop}>
      <DataTable columns={columns} rows={data} loading={loading} emptyIcon={Laptop} emptyMessage="No company assets are assigned to you." />
    </Card>
  );
}

function ProfileContent() {
  const { user, setUser } = useAuth();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    const requested = searchParams.get('tab');
    if (requested && TABS.some((t) => t.value === requested)) setTab(requested);
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <ProfileHeader employee={user} />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'overview' && <ProfileOverview employee={user} showSensitive />}
      {tab === 'edit' && (
        <EditPersonalInfo
          user={user}
          onCancel={() => setTab('overview')}
          onSaved={(updated) => {
            setUser(updated);
            setTab('overview');
          }}
        />
      )}
      {tab === 'assets' && <MyAssets />}
      {tab === 'security' && <ChangePassword />}
    </div>
  );
}

export default function ProfilePage() {
  // useSearchParams needs a Suspense boundary in Next.js
  return (
    <Suspense fallback={null}>
      <ProfileContent />
    </Suspense>
  );
}
