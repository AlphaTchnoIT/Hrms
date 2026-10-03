// Label/value pair used on profile & detail pages
export default function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{value || value === 0 ? value : '—'}</dd>
    </div>
  );
}
