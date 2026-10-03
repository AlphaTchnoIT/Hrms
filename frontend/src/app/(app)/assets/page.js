'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Laptop, Pencil, Plus, Search, Trash2, Undo2, UserPlus } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { assetSchema, assignAssetSchema } from '@/lib/validation';
import { ASSET_CATEGORIES, ASSET_STATUS, HR_ROLES } from '@/lib/constants';
import { formatCurrency, formatDate, getFullName, titleCase, toInputDate } from '@/lib/format';
import { Badge, Button, Card, DataTable, Input, Modal, PageHeader, Pagination, Select, Textarea, useConfirm } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import RoleGuard from '@/components/layout/RoleGuard';

function AssetModal({ asset, onClose, onSaved }) {
  const form = useForm(
    {
      name: asset?.name || '',
      category: asset?.category || 'laptop',
      brand: asset?.brand || '',
      serialNumber: asset?.serialNumber || '',
      purchaseDate: asset?.purchaseDate || '',
      purchaseCost: asset?.purchaseCost ?? '',
      status: asset?.status || 'available',
      notes: asset?.notes || '',
    },
    { schema: assetSchema }
  );
  const { register } = form;

  const onSubmit = form.handleSubmit(async (data) => {
    const res = asset ? await api.put(`/assets/${asset._id}`, data) : await api.post('/assets', data);
    toast.success(res.message);
    onSaved();
    onClose();
  });

  // "assigned" is only set through the Assign action
  const statusOptions = ASSET_STATUS.filter((s) => s !== 'assigned' || asset?.status === 'assigned');

  return (
    <Modal
      open
      onClose={onClose}
      title={asset ? `Edit ${asset.assetTag}` : 'Add asset'}
      description={asset ? undefined : 'An asset tag is generated automatically.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="asset-form" loading={form.submitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="asset-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Input label="Asset name" required placeholder='e.g. MacBook Air 13"' {...register('name')} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Category" required placeholder={false} options={ASSET_CATEGORIES} {...register('category')} />
          <Input label="Brand" {...register('brand')} />
          <Input label="Serial number" {...register('serialNumber')} />
          <Input label="Purchase date" type="date" max={toInputDate()} {...register('purchaseDate')} />
          <Input label="Purchase cost" type="number" min="0" prefix="₹" {...register('purchaseCost')} />
          {asset && (
            <Select
              label="Status"
              placeholder={false}
              options={statusOptions}
              disabled={asset.status === 'assigned'}
              hint={asset.status === 'assigned' ? 'Return the asset to change status' : undefined}
              {...register('status')}
            />
          )}
        </div>
        <Textarea label="Notes" maxLength={500} {...register('notes')} />
      </form>
    </Modal>
  );
}

function AssignModal({ asset, onClose, onSaved }) {
  const people = useFetch('/employees/directory', { params: { limit: 200 } });
  const form = useForm({ userId: '', assignedDate: toInputDate() }, { schema: assignAssetSchema });

  const onSubmit = form.handleSubmit(async (data) => {
    const res = await api.patch(`/assets/${asset._id}/assign`, data);
    toast.success(res.message);
    onSaved();
    onClose();
  });

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={`Assign ${asset.name}`}
      description={asset.assetTag}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="assign-form" loading={form.submitting}>
            Assign
          </Button>
        </>
      }
    >
      <form id="assign-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Select
          label="Employee"
          required
          options={(people.data || []).map((p) => ({ value: p._id, label: `${getFullName(p)} (${p.employeeCode})` }))}
          {...form.register('userId')}
        />
        <Input label="Assigned on" type="date" required max={toInputDate()} {...form.register('assignedDate')} />
      </form>
    </Modal>
  );
}

export default function AssetsPage() {
  const confirm = useConfirm();
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(undefined);
  const [assigning, setAssigning] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, meta, loading, refetch } = useFetch('/assets', { params: { ...filters, search: query, page, limit: 15 } });

  const act = async (request, options) => {
    if (!(await confirm(options))) return;
    try {
      const res = await request();
      toast.success(res.message);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    {
      key: 'asset',
      header: 'Asset',
      render: (a) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <Laptop className="h-4 w-4" />
          </span>
          <div>
            <p className="font-medium text-slate-800">{a.name}</p>
            <p className="text-xs text-slate-500">
              <span className="font-mono">{a.assetTag}</span> · {a.brand || titleCase(a.category)}
            </p>
          </div>
        </div>
      ),
    },
    { key: 'serial', header: 'Serial no.', render: (a) => (a.serialNumber ? <span className="font-mono text-xs">{a.serialNumber}</span> : '—') },
    { key: 'cost', header: 'Cost', align: 'right', render: (a) => (a.purchaseCost ? formatCurrency(a.purchaseCost) : '—') },
    { key: 'status', header: 'Status', render: (a) => <Badge status={a.status} /> },
    {
      key: 'assignee',
      header: 'Assigned to',
      render: (a) => (a.assignedTo ? <EmployeeCell employee={a.assignedTo} subtitle={`since ${formatDate(a.assignedDate)}`} /> : <span className="text-slate-400">—</span>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (a) => (
        <div className="flex justify-end gap-1">
          {a.status === 'available' && (
            <Button size="sm" variant="secondary" icon={UserPlus} onClick={() => setAssigning(a)}>
              Assign
            </Button>
          )}
          {a.status === 'assigned' && (
            <Button
              size="sm"
              variant="secondary"
              icon={Undo2}
              onClick={() =>
                act(() => api.patch(`/assets/${a._id}/return`), {
                  title: 'Mark as returned?',
                  message: `${a.name} will be marked available again.`,
                  confirmText: 'Mark returned',
                })
              }
            >
              Return
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={Pencil} label="Edit" onClick={() => setEditing(a)} />
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            label="Delete"
            onClick={() =>
              act(() => api.delete(`/assets/${a._id}`), {
                title: `Delete ${a.assetTag}?`,
                message: 'This asset will be permanently removed from the inventory.',
                confirmText: 'Delete',
                danger: true,
              })
            }
          />
        </div>
      ),
    },
  ];

  return (
    <RoleGuard roles={HR_ROLES}>
      <PageHeader
        title="Assets"
        subtitle="Track company equipment and who has it."
        actions={
          <Button icon={Plus} onClick={() => setEditing(null)}>
            Add asset
          </Button>
        }
      />

      <Card noPadding>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input className="form-control pl-9" placeholder="Search name, tag, serial" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select placeholder="All categories" options={ASSET_CATEGORIES} value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))} />
          <Select placeholder="All statuses" options={ASSET_STATUS} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} />
        </div>
        <DataTable columns={columns} rows={data} loading={loading} emptyIcon={Laptop} emptyMessage="No assets match your filters" />
        <Pagination meta={meta} onPageChange={setPage} />
      </Card>

      {editing !== undefined && <AssetModal asset={editing} onClose={() => setEditing(undefined)} onSaved={refetch} />}
      {assigning && <AssignModal asset={assigning} onClose={() => setAssigning(null)} onSaved={refetch} />}
    </RoleGuard>
  );
}
