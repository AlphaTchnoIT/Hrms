'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { BellRing, CheckCircle2, Circle, Plus, Trash2, UserPlus } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { useForm } from '@/hooks/useForm';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useTabParam } from '@/hooks/useTabParam';
import { AUDITOR_ROLES } from '@/lib/constants';
import { formatDate, formatDateTime, getFullName, toInputDate } from '@/lib/format';
import { Badge, Button, Card, Checkbox, DataTable, Input, Modal, PageHeader, Select, Tabs, Textarea } from '@/components/ui';
import EmployeeCell from '@/components/shared/EmployeeCell';
import { ReportCardModal } from '@/components/learning/ReportCard';
import RoleGuard from '@/components/layout/RoleGuard';

function PeoplePicker({ members, value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div>
      <div className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2">
        {members.map((m) => (
          <Checkbox key={m._id} label={getFullName(m)} checked={value.includes(m._id)} onChange={() => toggle(m._id)} />
        ))}
      </div>
      <div className="mt-1 flex gap-3 text-xs">
        <button type="button" className="font-medium text-brand-600" onClick={() => onChange(members.map((m) => m._id))}>
          Select all
        </button>
        <button type="button" className="font-medium text-slate-500" onClick={() => onChange([])}>
          Clear
        </button>
      </div>
    </div>
  );
}

function ProgramModal({ open, program, onClose, onSaved }) {
  const blank = { title: '', description: '', category: 'process', durationHours: 1, contentUrl: '', completionCriteria: '', isActive: true };
  const form = useForm(blank);
  useEffect(() => {
    if (open) form.reset(program ? { ...blank, ...program } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, program]);
  const onSubmit = form.handleSubmit(async (data) => {
    const { title, description, category, durationHours, contentUrl, completionCriteria, isActive } = data;
    const payload = { title, description, category, durationHours: Number(durationHours), contentUrl, completionCriteria, isActive };
    const res = program ? await api.put(`/learning/programs/${program._id}`, payload) : await api.post('/learning/programs', payload);
    toast.success(res.message);
    onSaved();
    onClose();
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={program ? 'Edit programme' : 'New training programme'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="program-form" loading={form.submitting}>
            Save
          </Button>
        </>
      }
    >
      <form id="program-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input label="Title" required className="sm:col-span-2" {...form.register('title')} />
        <Input label="Category" {...form.register('category')} />
        <Input label="Duration (hours)" type="number" min="0" step="0.5" {...form.register('durationHours')} />
        <Input label="Content link" className="sm:col-span-2" {...form.register('contentUrl')} />
        <Textarea label="Description" rows={2} className="sm:col-span-2" {...form.register('description')} />
        <Input label="Completion requirement" className="sm:col-span-2" {...form.register('completionCriteria')} />
        <Checkbox label="Active" {...form.register('isActive', { type: 'checkbox' })} />
      </form>
    </Modal>
  );
}

function AssignModal({ program, members, onClose, onSaved }) {
  const [users, setUsers] = useState([]);
  const [dueDate, setDueDate] = useState(toInputDate(new Date(Date.now() + 14 * 86400000)));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const res = await api.post('/learning/assignments', { program: program._id, users, dueDate });
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
      onClose={onClose}
      title={`Assign: ${program.title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!users.length} onClick={save}>
            Assign to {users.length}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <PeoplePicker members={members} value={users} onChange={setUsers} />
        <Input label="Due date" type="date" min={toInputDate()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </div>
    </Modal>
  );
}

const blankQuestion = () => ({ text: '', options: ['', ''], correctIndex: 0, marks: 1, explanation: '' });

const SHOW_ANSWER_OPTIONS = [
  { value: 'after-final', label: 'After they pass or use all attempts' },
  { value: 'after-submit', label: 'Right after every attempt' },
  { value: 'never', label: 'Never (only managers / HR see them)' },
];

function TestModal({ open, members, onClose, onSaved }) {
  const [test, setTest] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [everyone, setEveryone] = useState(true);

  useEffect(() => {
    if (open) {
      setTest({ title: '', description: '', passPercent: 70, maxAttempts: 2, timeLimitMinutes: 0, showAnswers: 'after-final', availableFrom: '', dueDate: toInputDate(new Date(Date.now() + 7 * 86400000)), assignedTo: [], questions: [blankQuestion()] });
      setEveryone(true);
      setErrors({});
    }
  }, [open]);
  if (!test) return null;

  const set = (key, value) => setTest((t) => ({ ...t, [key]: value }));
  const setQ = (qi, patch) => set('questions', test.questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...test,
        passPercent: Number(test.passPercent),
        maxAttempts: Number(test.maxAttempts),
        timeLimitMinutes: Number(test.timeLimitMinutes),
        assignedTo: everyone ? [] : test.assignedTo,
        questions: test.questions.map((q) => ({ ...q, correctIndex: Number(q.correctIndex), marks: Number(q.marks) })),
      };
      const res = await api.post('/learning/tests', payload);
      toast.success(res.message);
      onSaved();
      onClose();
    } catch (err) {
      setErrors(err.errors || {});
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="New knowledge test"
      description="Employees take it inside the app; scores are recorded automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save}>
            Publish test
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Title" required className="sm:col-span-3" value={test.title} error={errors.title} onChange={(e) => set('title', e.target.value)} />
          <Textarea label="Description" rows={2} className="sm:col-span-3" value={test.description} onChange={(e) => set('description', e.target.value)} />
          <Input label="Pass mark (%)" type="number" value={test.passPercent} onChange={(e) => set('passPercent', e.target.value)} />
          <Input label="Attempts allowed" type="number" min="1" value={test.maxAttempts} onChange={(e) => set('maxAttempts', e.target.value)} />
          <Input label="Time limit (min, 0 = none)" type="number" min="0" value={test.timeLimitMinutes} onChange={(e) => set('timeLimitMinutes', e.target.value)} />
          <Input label="Available from" type="date" value={test.availableFrom} onChange={(e) => set('availableFrom', e.target.value)} />
          <Input label="Due date" type="date" value={test.dueDate} error={errors.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          <Select
            label="Show correct answers to employees"
            placeholder={false}
            options={SHOW_ANSWER_OPTIONS}
            value={test.showAnswers}
            onChange={(e) => set('showAnswers', e.target.value)}
          />
        </div>
        <div>
          <Checkbox label="Available to everyone" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />
          {!everyone && (
            <div className="mt-2">
              <PeoplePicker members={members} value={test.assignedTo} onChange={(v) => set('assignedTo', v)} />
            </div>
          )}
        </div>
        <div className="space-y-4">
          {test.questions.map((q, qi) => (
            <div key={qi} className="rounded-xl border border-slate-200 p-4">
              <div className="flex gap-2">
                <Input label={`Question ${qi + 1}`} className="flex-1" value={q.text} error={errors[`questions.${qi}.text`]} onChange={(e) => setQ(qi, { text: e.target.value })} />
                <Input label="Marks" type="number" min="1" className="w-24" value={q.marks} onChange={(e) => setQ(qi, { marks: e.target.value })} />
              </div>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => {
                  const isCorrect = Number(q.correctIndex) === oi;
                  return (
                    <div key={oi} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQ(qi, { correctIndex: oi })}
                        className={clsx(
                          'inline-flex w-28 shrink-0 items-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition',
                          isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-700'
                        )}
                        aria-pressed={isCorrect}
                      >
                        {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        {isCorrect ? 'Correct' : 'Mark correct'}
                      </button>
                      <input className={clsx('form-control', isCorrect && 'border-emerald-400')} placeholder={`Option ${oi + 1}`} value={opt} onChange={(e) => setQ(qi, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })} />
                      <Button
                        variant="ghost"
                        icon={Trash2}
                        label="Remove option"
                        disabled={q.options.length <= 2}
                        onClick={() => {
                          // Keep the same option marked correct after removing one above it
                          const current = Number(q.correctIndex);
                          const correctIndex = oi === current ? 0 : oi < current ? current - 1 : current;
                          setQ(qi, { options: q.options.filter((_, i) => i !== oi), correctIndex });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between">
                <Button variant="link" size="sm" disabled={q.options.length >= 6} onClick={() => setQ(qi, { options: [...q.options, ''] })}>
                  + Option
                </Button>
                <Button variant="link" size="sm" className="text-red-600" disabled={test.questions.length === 1} onClick={() => set('questions', test.questions.filter((_, i) => i !== qi))}>
                  Remove question
                </Button>
              </div>
              <Textarea
                label="Explanation (optional)"
                rows={2}
                className="mt-2"
                placeholder="Why this answer is correct. Shown in the report card with the answers."
                value={q.explanation}
                onChange={(e) => setQ(qi, { explanation: e.target.value })}
              />
              {errors[`questions.${qi}.correctIndex`] && <p className="mt-1 text-xs font-medium text-red-600">{errors[`questions.${qi}.correctIndex`]}</p>}
            </div>
          ))}
          {errors.questions && <p className="text-xs font-medium text-red-600">{errors.questions}</p>}
          <Button variant="secondary" icon={Plus} onClick={() => set('questions', [...test.questions, blankQuestion()])}>
            Add question
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResultsModal({ testId, onClose }) {
  const { data } = useFetch(testId ? `/learning/tests/${testId}/results` : null);
  const [report, setReport] = useState(null);
  const columns = [
    { key: 'employee', header: 'Employee', render: (a) => <EmployeeCell employee={a.user} /> },
    { key: 'attempt', header: 'Attempt', render: (a) => `#${a.attemptNo}` },
    { key: 'score', header: 'Score', render: (a) => `${a.percent}%` },
    { key: 'result', header: 'Result', render: (a) => <Badge status={a.passed ? 'passed' : 'failed'} /> },
    { key: 'date', header: 'Submitted', render: (a) => formatDateTime(a.submittedAt) },
    { key: 'report', header: '', render: (a) => <Button size="xs" variant="secondary" onClick={() => setReport(a._id)}>Report card</Button> },
  ];
  return (
    <>
      <Modal open={Boolean(testId) && !report} onClose={onClose} size="xl" title={data?.test?.title || 'Results'}>
        <DataTable columns={columns} rows={data?.attempts} loading={!data} emptyMessage="Nobody has taken this test yet" />
      </Modal>
      <ReportCardModal attemptId={report} onClose={() => setReport(null)} />
    </>
  );
}

// The questions of a test with the correct answer marked (answer key for the creator / HR)
function AnswerKeyModal({ test, onClose }) {
  return (
    <Modal open={Boolean(test)} onClose={onClose} size="lg" title={test?.title || 'Answer key'} description={test && `Answer key · ${test.questions.length} questions · pass ${test.passPercent}%`}>
      {test && (
        <ol className="space-y-4">
          {test.questions.map((q, qi) => (
            <li key={q._id || qi} className="rounded-xl border border-slate-200 p-4">
              <p className="font-medium text-slate-800">
                {qi + 1}. {q.text} <span className="text-xs font-normal text-slate-400">({q.marks} mark{q.marks > 1 ? 's' : ''})</span>
              </p>
              <div className="mt-2 grid gap-1.5">
                {q.options.map((opt, oi) => (
                  <div key={oi} className={clsx('flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm', oi === q.correctIndex ? 'border-emerald-400 bg-emerald-50 font-medium text-emerald-900' : 'border-slate-200 text-slate-600')}>
                    {oi === q.correctIndex ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-slate-300" />}
                    {opt}
                  </div>
                ))}
              </div>
              {q.explanation && <p className="mt-2 text-sm text-slate-500">💡 {q.explanation}</p>}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

export default function TrainingAdminPage() {
  const { isHR } = useAuth();
  const [tab, setTab] = useTabParam('programs', ['programs', 'assignments', 'tests']);
  const { members } = useTeamMembers();
  const programs = useFetch('/learning/programs');
  const assignments = useFetch(tab === 'assignments' ? '/learning/assignments' : null);
  const tests = useFetch(tab === 'tests' ? '/learning/tests' : null);
  const [programModal, setProgramModal] = useState(undefined);
  const [assigning, setAssigning] = useState(null);
  const [testOpen, setTestOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [answerKey, setAnswerKey] = useState(null);

  const runReminders = async () => {
    try {
      const res = await api.post('/learning/reminders/run');
      toast.success(res.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const programColumns = [
    { key: 'title', header: 'Programme', render: (p) => (<div><p className="font-medium">{p.title}</p><p className="text-xs text-slate-500">{p.category} · {p.durationHours}h</p></div>) },
    { key: 'assigned', header: 'Assigned', render: (p) => p.assigned },
    { key: 'completed', header: 'Completed', render: (p) => `${p.completed} (${p.assigned ? Math.round((p.completed / p.assigned) * 100) : 0}%)` },
    { key: 'active', header: 'Status', render: (p) => <Badge color={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex gap-1">
          <Button size="xs" icon={UserPlus} disabled={!p.isActive} onClick={() => setAssigning(p)}>
            Assign
          </Button>
          <Button size="xs" variant="secondary" onClick={() => setProgramModal(p)}>
            Edit
          </Button>
        </div>
      ),
    },
  ];
  const assignmentColumns = [
    { key: 'employee', header: 'Employee', render: (a) => <EmployeeCell employee={a.user} /> },
    { key: 'program', header: 'Programme', render: (a) => a.program?.title },
    { key: 'due', header: 'Due', render: (a) => formatDate(a.dueDate) },
    { key: 'progress', header: 'Progress', render: (a) => `${a.progress}%` },
    { key: 'status', header: 'Status', render: (a) => <Badge status={a.status !== 'completed' && a.dueDate < toInputDate() ? 'overdue' : a.status} /> },
    { key: 'completed', header: 'Completed on', render: (a) => (a.completedAt ? formatDate(a.completedAt) : '—') },
  ];
  const testColumns = [
    { key: 'title', header: 'Test', render: (t) => (<div><p className="font-medium">{t.title}</p><p className="text-xs text-slate-500">{t.questions.length} questions · pass {t.passPercent}%</p></div>) },
    { key: 'audience', header: 'Audience', render: (t) => (t.assignedTo.length ? `${t.assignedTo.length} people` : 'Everyone') },
    { key: 'due', header: 'Due', render: (t) => (t.dueDate ? formatDate(t.dueDate) : '—') },
    { key: 'takers', header: 'Taken by', render: (t) => t.stats.takers },
    { key: 'avg', header: 'Avg score', render: (t) => (t.stats.averagePercent === null ? '—' : `${t.stats.averagePercent}%`) },
    { key: 'passed', header: 'Passed attempts', render: (t) => t.stats.passed },
    {
      key: 'results',
      header: '',
      render: (t) => (
        <div className="flex gap-1">
          <Button size="xs" variant="secondary" onClick={() => setAnswerKey(t)}>
            Answer key
          </Button>
          <Button size="xs" variant="secondary" onClick={() => setResults(t._id)}>
            Results
          </Button>
        </div>
      ),
    },
  ];

  return (
    <RoleGuard roles={AUDITOR_ROLES}>
      <PageHeader
        title="Training Admin"
        subtitle="Create training programmes and knowledge tests, assign them and follow completion"
        actions={
          <>
            {isHR && (
              <Button variant="secondary" icon={BellRing} onClick={runReminders}>
                Send reminders now
              </Button>
            )}
            {tab === 'tests' ? (
              <Button icon={Plus} onClick={() => setTestOpen(true)}>
                New test
              </Button>
            ) : (
              <Button icon={Plus} onClick={() => setProgramModal(null)}>
                New programme
              </Button>
            )}
          </>
        }
      />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'programs', label: 'Programmes' },
          { value: 'assignments', label: 'Assignments' },
          { value: 'tests', label: 'Knowledge tests' },
        ]}
      />
      <Card noPadding>
        {tab === 'programs' && <DataTable columns={programColumns} rows={programs.data} loading={programs.loading} emptyMessage="No programmes yet" />}
        {tab === 'assignments' && <DataTable columns={assignmentColumns} rows={assignments.data} loading={assignments.loading} emptyMessage="No training assigned" />}
        {tab === 'tests' && <DataTable columns={testColumns} rows={tests.data} loading={tests.loading} emptyMessage="No tests yet" />}
      </Card>
      <p className="mt-3 text-xs text-slate-500">Reminders for upcoming and overdue tests and training are also sent automatically every hour.</p>

      <ProgramModal open={programModal !== undefined} program={programModal} onClose={() => setProgramModal(undefined)} onSaved={programs.refetch} />
      {assigning && <AssignModal program={assigning} members={members} onClose={() => setAssigning(null)} onSaved={programs.refetch} />}
      <TestModal open={testOpen} members={members} onClose={() => setTestOpen(false)} onSaved={tests.refetch} />
      <ResultsModal testId={results} onClose={() => setResults(null)} />
      <AnswerKeyModal test={answerKey} onClose={() => setAnswerKey(null)} />
    </RoleGuard>
  );
}
