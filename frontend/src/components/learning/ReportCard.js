'use client';

import clsx from 'clsx';
import { CheckCircle2, Circle, EyeOff, Lightbulb, XCircle } from 'lucide-react';
import { useFetch } from '@/hooks/useFetch';
import { formatDateTime, getFullName } from '@/lib/format';
import { Button, ErrorMessage, Modal, PageLoader } from '@/components/ui';

/*
 * Report card of one test attempt: score, pass / fail and every question with
 * the answer given and (when allowed) the correct answer and explanation.
 *   card = GET /learning/attempts/:id  (or reportCard from submitting an attempt)
 */
export default function ReportCard({ card }) {
  const unanswered = card.questions.filter((q) => q.chosenIndex === -1).length;

  return (
    <div className="space-y-5">
      <div className={clsx('flex flex-wrap items-center gap-5 rounded-xl p-4', card.passed ? 'bg-emerald-50' : 'bg-rose-50')}>
        <div className={clsx('flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 bg-white', card.passed ? 'border-emerald-400' : 'border-rose-400')}>
          <span className="text-xl font-bold text-slate-900">{card.percent}%</span>
        </div>
        <div className="min-w-0 flex-1">
          {card.user && <p className="text-sm font-medium text-slate-600">{getFullName(card.user)}</p>}
          <p className={clsx('text-lg font-semibold', card.passed ? 'text-emerald-800' : 'text-rose-800')}>{card.passed ? 'Passed 🎉' : 'Not passed'}</p>
          <p className="text-sm text-slate-600">
            {card.score}/{card.totalMarks} marks · {card.correctCount} of {card.questions.length} correct
            {unanswered ? ` · ${unanswered} unanswered` : ''} · pass mark {card.test.passPercent}%
          </p>
          <p className="text-xs text-slate-500">
            Attempt {card.attemptNo} of {card.test.maxAttempts} · {formatDateTime(card.submittedAt)}
          </p>
        </div>
      </div>

      {!card.answersVisible && (
        <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          Correct answers are shown once you pass the test or use all your attempts, so retakes stay fair.
        </p>
      )}

      <ol className="space-y-4">
        {card.questions.map((q, qi) => (
          <li key={q._id || qi} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-slate-800">
                {qi + 1}. {q.text}
              </p>
              <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', q.correct ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
                {q.marksScored}/{q.marks}
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {q.options.map((opt, oi) => {
                const isChosen = q.chosenIndex === oi;
                const isCorrect = q.correctIndex === oi;
                const Icon = isCorrect ? CheckCircle2 : isChosen ? XCircle : Circle;
                return (
                  <div
                    key={oi}
                    className={clsx(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                      isCorrect ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : isChosen ? (q.correct ? 'border-emerald-400 bg-emerald-50' : 'border-rose-400 bg-rose-50 text-rose-900') : 'border-slate-200 text-slate-600'
                    )}
                  >
                    <Icon className={clsx('h-4 w-4 shrink-0', isCorrect || (isChosen && q.correct) ? 'text-emerald-600' : isChosen ? 'text-rose-600' : 'text-slate-300')} />
                    <span className="flex-1">{opt}</span>
                    {isChosen && <span className="text-xs font-medium">Your answer</span>}
                    {isCorrect && !isChosen && <span className="text-xs font-medium text-emerald-700">Correct answer</span>}
                  </div>
                );
              })}
            </div>
            {q.chosenIndex === -1 && <p className="mt-2 text-xs text-rose-600">Not answered</p>}
            {q.explanation && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" /> {q.explanation}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// Opens the report card of an attempt by id
export function ReportCardModal({ attemptId, onClose }) {
  const { data, loading, error } = useFetch(attemptId ? `/learning/attempts/${attemptId}` : null);
  return (
    <Modal
      open={Boolean(attemptId)}
      onClose={onClose}
      size="lg"
      title={data?.test?.title || 'Report card'}
      description="Report card"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <ErrorMessage message={error} />
      {loading && !data ? <PageLoader /> : data && <ReportCard card={data} />}
    </Modal>
  );
}
