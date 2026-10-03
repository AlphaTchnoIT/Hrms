'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { departmentSchema, designationSchema } from '@/lib/validation';
import { HR_ROLES } from '@/lib/constants';
import { getFullName } from '@/lib/format';
import { Badge, Button, Card, Checkbox, DataTable, Input, Modal, PageHeader, Select, Tabs, Textarea, useConfirm } from '@/components/ui';
import RoleGuard from '@/components/layout/RoleGuard';

// Shared modal for creating / editing a department or designation
function OrgItemModal({ type, item, onClose, onSaved, people }) {
  const isDepartment = type === 'departments';
  const initial = isDepartment
    ? { name: item?.name || '', code: item?.code || '', description: item?.description || '', head: item?.head?._id || '', isActive: item?.isActive ?? true }
    : { title: item?.title || '', level: item?.level ?? '', description: item?.description || '', isActive: item?.isActive ?? true };

  const form = useForm(initial, { schema: isDepartment ? departmentSchema : designationSchema });
  const { register } = form;

  const onSubmit = form.handleSubmit(async (data) => {
    const res = item ? await api.put(`/${type}/${item._id}`, data) : await api.post(`/${type}`, data);
    toast.success(res.message);
    onSaved();
    onClose();
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`${item ? 'Edit' : 'New'} ${isDepartment ? 'department' : 'designation'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="org-form" loading={form.submitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="org-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {isDepartment ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Name" required className="col-span-2" placeholder="e.g. Engineering" {...register('name')} />
              <Input label="Code" placeholder="ENG" {...register('code')} />
            </div>
            <Select label="Department head" placeholder="None" options={people.map((p) => ({ value: p._id, label: getFullName(p) }))} {...register('head')} />
          </>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <Input label="Title" required className="col-span-2" placeholder="e.g. Software Engineer" {...register('title')} />
            <Input label="Level" type="number" min="1" max="20" required hint="1 = entry" {...register('level')} />
          </div>
        )}
        <Textarea label="Description" maxLength={300} {...register('description')} />
        <Checkbox label="Active" description="Inactive items are hidden from new employee forms" {...register('isActive', { type: 'checkbox' })} />
      </form>
    </Modal>
  );
}

export default function OrganizationPage() {
  const confirm = useConfirm();
  const [tab, setTab] = useState('departments');
  const [editing, setEditing] = useState(undefined); // undefined closed, null new
  const departments = useFetch('/departments');
  const designations = useFetch('/designations');
  const people = useFetch('/employees/directory', { params: { limit: 200 } });

  const current = tab === 'departments' ? departments : designations;
  const singular = tab === 'departments' ? 'department' : 'designation';

  const remove = async (item) => {
    const ok = await confirm({
      title: `Delete ${item.name || item.title}?`,
      message: `This ${singular} will be permanently removed.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.delete(`/${tab}/${item._id}`);
      toast.success(res.message);
      current.refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const actions = {
    key: 'actions',
    header: '',
    align: 'right',
    render: (item) => (
      <div className="flex justify-end gap-1">
        <Button size="sm" variant="ghost" icon={Pencil} label="Edit" onClick={() => setEditing(item)} />
        <Button size="sm" variant="ghost" icon={Trash2} label="Delete" onClick={() => remove(item)} />
      </div>
    ),
  };

  const departmentColumns = [
    {
      key: 'name',
      header: 'Department',
      render: (d) => (
        <div>
          <p className="font-medium text-slate-800">{d.name}</p>
          {d.description && <p className="max-w-xs truncate text-xs text-slate-500">{d.description}</p>}
        </div>
      ),
    },
    { key: 'code', header: 'Code', render: (d) => (d.code ? <span className="font-mono text-xs">{d.code}</span> : '—') },
    { key: 'head', header: 'Head', render: (d) => (d.head ? getFullName(d.head) : <span className="text-slate-400">Not set</span>) },
    { key: 'count', header: 'Employees', render: (d) => d.employeeCount },
    { key: 'status', header: 'Status', render: (d) => <Badge status={d.isActive ? 'active' : 'inactive'} /> },
    actions,
  ];

  const designationColumns = [
    { key: 'title', header: 'Designation', render: (d) => <span className="font-medium text-slate-800">{d.title}</span> },
    { key: 'level', header: 'Level', render: (d) => `L${d.level}` },
    { key: 'count', header: 'Employees', render: (d) => d.employeeCount },
    { key: 'status', header: 'Status', render: (d) => <Badge status={d.isActive ? 'active' : 'inactive'} /> },
    actions,
  ];

  return (
    <RoleGuard roles={HR_ROLES}>
      <PageHeader
        title="Organization"
        subtitle="Structure your company with departments and designations."
        actions={
          <Button icon={Plus} onClick={() => setEditing(null)}>
            Add {singular}
          </Button>
        }
      />
      <Tabs
        tabs={[
          { value: 'departments', label: 'Departments', count: departments.data?.length },
          { value: 'designations', label: 'Designations', count: designations.data?.length },
        ]}
        value={tab}
        onChange={setTab}
      />
      <Card noPadding className="mt-4">
        <DataTable
          columns={tab === 'departments' ? departmentColumns : designationColumns}
          rows={current.data}
          loading={current.loading}
          emptyIcon={Building2}
          emptyMessage={`No ${tab} yet`}
        />
      </Card>

      {editing !== undefined && (
        <OrgItemModal type={tab} item={editing} people={people.data || []} onClose={() => setEditing(undefined)} onSaved={current.refetch} />
      )}
    </RoleGuard>
  );
}
