'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Award, BookOpen, ClipboardList, ExternalLink, Timer, TriangleAlert } from 'lucide-react';
import api from '@/lib/api';
import { useFetch } from '@/hooks/useFetch';
import { useTabParam } from '@/hooks/useTabParam';
import { formatDate, formatDateTime } from '@/lib/format';
import { Badge, Button, Card, DataTable, EmptyState, ErrorMessage, Modal, PageHeader, PageLoader, StatCard, Tabs } from '@/components/ui';
import ReportCard, { ReportCardModal } from '@/components/learning/ReportCard';

function TakeTestModal({ testId, onClose, onDone }) {
  const { data: test, loading, error } = useFetch(testId ? `/learning/tests/${testId}/take` : null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!test) return;
    setAnswers(test.questions.map(() => -1));
    setResult(null);
    setSecondsLeft(test.timeLimitMinutes ? test.timeLimitMinutes * 60 : null);
  }, [test]);

  useEffect(() => {
    if (secondsLeft === null || result) return undefined;
    if (secondsLeft <= 0) {
      submit();
      return undefined;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/learning/tests/${testId}/attempts`, { answers });
      setResult(res.data);
      toast[res.data.attempt.passed ? 'success' : 'error'](res.message);
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const unanswered = answers.filter((a) => a === -1).length;

  return (
    <Modal
      open={Boolean(testId)}
      onClose={onClose}
      size="lg"
      title={test?.title || 'Knowledge test'}
      description={test && `Attempt ${test.attemptNo} of ${test.maxAttempts} · pass mark ${test.passPercent}%`}
      footer={
        result ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            {secondsLeft !== null && (
              <span className="mr-auto flex items-center gap-1 text-sm font-medium text-slate-600">
                <Timer className="h-4 w-4" /> {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </span>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={submitting} disabled={!test || unanswered > 0} onClick={submit}>
              Submit {unanswered ? `(${unanswered} left)` : ''}
            </Button>
          </>
        )
      }
    >
      {loading && <p className="text-sm text-slate-500">Loading…</p>}
      <ErrorMessage message={error} />
      {result && (
        <>
          {!result.attempt.passed && result.attemptsLeft > 0 && (
            <p className="mb-3 text-sm font-medium text-slate-600">{result.attemptsLeft} attempt(s) left. You can retake it from the Knowledge tests tab.</p>
          )}
          <ReportCard card={result.reportCard} />
        </>
      )}
      {test && !result && (
        <ol className="space-y-5">
          {test.questions.map((q, qi) => {
                    return (
              <li key={q._id}>
                <p className="font-medium text-slate-800">
                  {qi + 1}. {q.text} <span className="text-xs font-normal text-slate-400">({q.marks} mark{q.marks > 1 ? 's' : ''})</span>
                </p>
                <div className="mt-2 grid gap-2">
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={clsx(
                        'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                        answers[qi] === oi ? 'border-brand-500 bg-brand-50' : 'border-slate-200'
                      )}
                    >
                      <input type="radio" name={`q-${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))} />
                      {opt}
                    </label>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Modal>
  );
}

export default function LearningPage() {
  const [tab, setTab] = useTabParam('training', ['training', 'tests', 'records']);
  const { data, loading, error, refetch } = useFetch('/learning/my');
  const [taking, setTaking] = useState(null);
  const [report, setReport] = useState(null);

  const updateProgress = async (assignment, progress) => {
    try {
      const res = await api.patch(`/learning/assignments/${assignment._id}/progress`, { progress });
      toast.success(res.message);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const s = data?.summary || {};
  const attemptColumns = [
    { key: 'test', header: 'Test', render: (a) => a.test?.title || '—' },
    { key: 'attempt', header: 'Attempt', render: (a) => `#${a.attemptNo}` },
    { key: 'score', header: 'Score', render: (a) => `${a.score}/${a.totalMarks} (${a.percent}%)` },
    { key: 'result', header: 'Result', render: (a) => <Badge status={a.passed ? 'passed' : 'failed'} /> },
    { key: 'date', header: 'Completed', render: (a) => formatDateTime(a.submittedAt) },
    {
      key: 'report',
      header: '',
      render: (a) => (
        <Button size="xs" variant="secondary" disabled={!a.test} onClick={() => setReport(a._id)}>
          Report card
        </Button>
      ),
    },
  ];
  const completedColumns = [
    { key: 'program', header: 'Programme', render: (a) => a.program?.title },
    { key: 'hours', header: 'Hours', render: (a) => a.program?.durationHours },
    { key: 'completed', header: 'Completed on', render: (a) => formatDate(a.completedAt) },
  ];

  return (
    <div>
      <PageHeader title="Learning" subtitle="Assigned training programmes, knowledge tests and your training record" />
      <ErrorMessage message={error} onRetry={refetch} />
      {loading && !data && <PageLoader />}
      {data && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Trainings completed" value={`${s.trainingsCompleted} / ${s.trainingsAssigned}`} icon={BookOpen} />
            <StatCard label="Overdue trainings" value={s.trainingsOverdue} icon={TriangleAlert} tone={s.trainingsOverdue ? 'red' : 'green'} />
            <StatCard label="Tests pending" value={s.testsPending} icon={ClipboardList} tone="yellow" />
            <StatCard label="Average test score" value={s.averageScore === null ? '—' : `${s.averageScore}%`} icon={Award} tone="purple" />
          </div>
          <Tabs
            className="mb-4"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'training', label: 'Training plan', count: data.assignments.filter((a) => a.status !== 'completed').length },
              { value: 'tests', label: 'Knowledge tests', count: s.testsPending },
              { value: 'records', label: 'Training record' },
            ]}
          />

          {tab === 'training' && (
            <div className="grid gap-4 lg:grid-cols-2">
              {!data.assignments.length && <EmptyState icon={BookOpen} message="No training assigned yet." />}
              {data.assignments.map((a) => (
                <Card key={a._id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{a.program?.title}</h3>
                      <p className="text-xs text-slate-500">
                        {a.program?.durationHours}h · due {formatDate(a.dueDate)} · assigned by {a.assignedBy?.firstName || '—'}
                      </p>
                    </div>
                    <Badge status={a.isOverdue ? 'overdue' : a.status} />
                  </div>
                  {a.program?.description && <p className="mt-2 text-sm text-slate-600">{a.program.description}</p>}
                  {a.program?.completionCriteria && <p className="mt-1 text-xs text-slate-500">Completion: {a.program.completionCriteria}</p>}
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>Progress</span>
                      <span>{a.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={clsx('h-full rounded-full', a.progress >= 100 ? 'bg-emerald-500' : 'bg-brand-500')} style={{ width: `${a.progress}%` }} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    {a.program?.contentUrl && (
                      <a href={a.program.contentUrl} target="_blank" rel="noreferrer" className="mr-auto inline-flex items-center gap-1 text-xs font-medium text-brand-600">
                        Open content <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {a.status !== 'completed' &&
                      [25, 50, 75, 100]
                        .filter((p) => p > a.progress)
                        .map((p) => (
                          <Button key={p} size="xs" variant={p === 100 ? 'success-soft' : 'secondary'} onClick={() => updateProgress(a, p)}>
                            {p === 100 ? 'Mark complete' : `${p}%`}
                          </Button>
                        ))}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {tab === 'tests' && (
            <div className="grid gap-4 lg:grid-cols-2">
              {!data.tests.length && <EmptyState icon={ClipboardList} message="No knowledge tests available." />}
              {data.tests.map((t) => (
                <Card key={t._id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">{t.title}</h3>
                      <p className="text-xs text-slate-500">
                        {t.questionCount} questions · pass {t.passPercent}% · {t.attemptsUsed}/{t.maxAttempts} attempts
                        {t.timeLimitMinutes ? ` · ${t.timeLimitMinutes} min` : ''}
                        {t.dueDate ? ` · due ${formatDate(t.dueDate)}` : ''}
                      </p>
                    </div>
                    <Badge status={t.status} />
                  </div>
                  {t.description && <p className="mt-2 text-sm text-slate-600">{t.description}</p>}
                  {t.attempts.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                      {t.attempts.map((a) => (
                        <div key={a._id} className="flex items-center gap-3 text-sm">
                          <span className="w-20 text-slate-500">Attempt {a.attemptNo}</span>
                          <span className={clsx('font-semibold', a.passed ? 'text-emerald-600' : 'text-rose-600')}>{a.percent}%</span>
                          <span className="text-xs text-slate-400">{formatDate(a.submittedAt)}</span>
                          <Button size="xs" variant="link" className="ml-auto" onClick={() => setReport(a._id)}>
                            Report card
                          </Button>
                        </div>
                      ))}
                      {!t.answersVisible && t.showAnswers === 'after-final' && (
                        <p className="text-xs text-slate-400">Correct answers unlock once you pass or use all attempts.</p>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-slate-600">Best score: {t.bestPercent === null ? '—' : `${t.bestPercent}%`}</span>
                    {['pending', 'overdue'].includes(t.status) && (
                      <Button size="sm" onClick={() => setTaking(t._id)}>
                        {t.attemptsUsed ? 'Retake test' : 'Start test'}
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {tab === 'records' && (
            <div className="space-y-6">
              <Card noPadding title="Completed training">
                <DataTable columns={completedColumns} rows={data.assignments.filter((a) => a.status === 'completed')} emptyMessage="No completed training yet" />
              </Card>
              <Card noPadding title="Assessment attempts">
                <DataTable columns={attemptColumns} rows={data.attempts} emptyMessage="No test attempts yet" />
              </Card>
            </div>
          )}
        </>
      )}
      {taking && <TakeTestModal testId={taking} onClose={() => setTaking(null)} onDone={refetch} />}
      <ReportCardModal attemptId={report} onClose={() => setReport(null)} />
    </div>
  );
}
