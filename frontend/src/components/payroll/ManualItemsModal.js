'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { getCurrencySymbol } from '@/lib/format';
import { Button, Input, Modal, Select } from '@/components/ui';

const TYPES = [
  { value: 'deduction', label: 'Deduction' },
  { value: 'earning', label: 'Earning' },
  { value: 'employer', label: 'Employer contribution' },
];
const SUGGESTIONS = ['Income Tax', 'National Insurance', 'Pension (employee)', 'Student Loan', 'Holiday pay', 'Bonus', 'Overtime', 'Arrears', 'Employer National Insurance', 'Employer pension'];
const LIST_OF = { earning: 'earnings', deduction: 'deductions', employer: 'employerContributions' };

// Current manual items of a payslip as editable rows
const rowsOf = (payslip) =>
  Object.entries(LIST_OF).flatMap(([type, list]) => (payslip[list] || []).filter((i) => i.manual).map((i) => ({ type, name: i.name, amount: String(i.amount) })));

// Legal / payroll team's own entries on a payslip (tax, NI, pension, holiday pay, bonus...)
export default function ManualItemsModal({ payslip, onClose, onSaved }) {
  const [rows, setRows] = useState(() => (rowsOf(payslip).length ? rowsOf(payslip) : [{ type: 'deduction', name: '', amount: '' }]));
  const [saving, setSaving] = useState(false);
  const update = (index, patch) => setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const save = async () => {
    const items = rows.filter((r) => r.name.trim() || r.amount !== '').map((r) => ({ ...r, amount: Number(r.amount) || 0 }));
    if (items.some((i) => !i.name.trim())) return toast.error('Every item needs a name');
    setSaving(true);
    try {
      const res = await api.put(`/payroll/payslips/${payslip._id}/manual-items`, { items });
      toast.success(res.message);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="xl"
      onClose={onClose}
      title="Manual items"
      description={
        payslip.deductionMode === 'manual'
          ? 'Entries by the legal / payroll team, including tax, NI and pension. Totals are recalculated and kept if payroll is re-run.'
          : 'Tax, NI and pension are worked out automatically (also on manual earnings). Add other items here; they are kept if payroll is re-run.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <datalist id="manual-item-names">
        {SUGGESTIONS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[180px_1fr_140px_auto]">
            <Select label="Type" placeholder={false} options={TYPES} value={row.type} onChange={(e) => update(index, { type: e.target.value })} />
            <Input label="Name" list="manual-item-names" maxLength={80} value={row.name} onChange={(e) => update(index, { name: e.target.value })} />
            <Input label="Amount" type="number" min="0" step="0.01" prefix={getCurrencySymbol()} value={row.amount} onChange={(e) => update(index, { amount: e.target.value })} />
            <Button variant="ghost" icon={Trash2} aria-label="Remove" onClick={() => setRows((list) => list.filter((_, i) => i !== index))} />
          </div>
        ))}
        <Button variant="secondary" size="sm" icon={Plus} onClick={() => setRows((list) => [...list, { type: 'deduction', name: '', amount: '' }])}>
          Add item
        </Button>
      </div>
    </Modal>
  );
}
