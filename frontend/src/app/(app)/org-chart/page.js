'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, LocateFixed, Pencil, Search, UserX } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import { getFullName } from '@/lib/format';
import { Avatar, Badge, Button, Card, EmptyState, ErrorMessage, PageHeader, PageLoader, Select } from '@/components/ui';

/*
 * Company org chart, built from each employee's reporting manager.
 * Everyone can view it (public info only); HR / admin get a shortcut to change someone's manager.
 */

function buildTree(people) {
  const byId = new Map(people.map((p) => [String(p._id), { ...p, id: String(p._id), children: [] }]));
  const roots = [];
  byId.forEach((node) => {
    const parent = node.reportingManager && byId.get(String(node.reportingManager));
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  // Total people under each node (direct + indirect)
  const countAll = (node) => (node.total = node.children.reduce((sum, child) => sum + 1 + countAll(child), 0));
  const sortTree = (nodes) => {
    nodes.sort((a, b) => b.total - a.total || getFullName(a).localeCompare(getFullName(b)));
    nodes.forEach((n) => sortTree(n.children));
  };
  roots.forEach(countAll);
  sortTree(roots);

  return { byId, leads: roots.filter((r) => r.children.length), unassigned: roots.filter((r) => !r.children.length) };
}

// IDs from the top of the chart down to (not including) this person
function ancestorIds(byId, id) {
  const ids = [];
  let current = byId.get(id);
  while (current?.reportingManager && byId.has(String(current.reportingManager)) && ids.length < 50) {
    const parentId = String(current.reportingManager);
    if (ids.includes(parentId)) break;
    ids.push(parentId);
    current = byId.get(parentId);
  }
  return ids;
}

function PersonNode({ node, depth, expanded, onToggle, highlight, meId, canEdit }) {
  const open = expanded.has(node.id);
  const hasTeam = node.children.length > 0;
  const name = getFullName(node);

  return (
    <li className="relative">
      {depth > 0 && <span className="absolute -left-4 top-7 h-px w-4 bg-slate-200" />}
      <div
        id={`org-${node.id}`}
        className={clsx(
          'flex items-center gap-3 rounded-xl border bg-white p-3 transition',
          node.id === meId ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-200',
          highlight === node.id && 'ring-2 ring-amber-300'
        )}
      >
        <button
          type="button"
          onClick={() => hasTeam && onToggle(node.id)}
          disabled={!hasTeam}
          aria-label={open ? `Hide ${name}'s team` : `Show ${name}'s team`}
          className={clsx('rounded-md p-1 text-slate-400', hasTeam ? 'hover:bg-slate-100 hover:text-slate-700' : 'invisible')}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Avatar name={name} src={node.avatar} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">
            {canEdit ? (
              <Link href={`/employees/${node.id}`} className="hover:text-brand-700">
                {name}
              </Link>
            ) : (
              name
            )}
            {node.id === meId && <span className="ml-2 text-xs font-medium text-brand-600">(You)</span>}
          </p>
          <p className="truncate text-xs text-slate-500">
            {[node.designation?.title, node.department?.name].filter(Boolean).join(' · ') || node.employeeCode || '—'}
          </p>
        </div>
        {hasTeam && (
          <span className="hidden whitespace-nowrap text-xs text-slate-500 sm:inline" title={`${node.children.length} direct, ${node.total} in total`}>
            {node.children.length} direct · {node.total} total
          </span>
        )}
        {canEdit && (
          <Link href={`/employees/${node.id}/edit`} title="Change reporting manager" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Pencil className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {open && hasTeam && (
        <ul className="relative ml-6 mt-2 space-y-2 border-l border-slate-200 pl-4">
          {node.children.map((child) => (
            <PersonNode key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} highlight={highlight} meId={meId} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OrgChartPage() {
  const { user, isHR } = useAuth();
  const { data, loading, error, refetch } = useFetch('/employees/org-chart');
  const departments = useFetch('/departments');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [highlight, setHighlight] = useState(null);

  const people = useMemo(() => data || [], [data]);
  const tree = useMemo(() => buildTree(people), [people]);
  const meId = user ? String(user._id) : null;

  // Start with the top levels open and the path down to the logged-in user
  useEffect(() => {
    if (!people.length) return;
    const open = new Set(tree.leads.map((n) => n.id));
    if (meId && tree.byId.has(meId)) ancestorIds(tree.byId, meId).forEach((id) => open.add(id));
    setExpanded(open);
  }, [people, tree, meId]);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Open the path to a person, then scroll to and briefly highlight them
  const focusPerson = (id) => {
    setExpanded((prev) => new Set([...prev, ...ancestorIds(tree.byId, id)]));
    setHighlight(id);
    setTimeout(() => document.getElementById(`org-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    setTimeout(() => setHighlight((current) => (current === id ? null : current)), 2500);
  };

  const expandAll = () => setExpanded(new Set([...tree.byId.values()].filter((n) => n.children.length).map((n) => n.id)));
  const collapseAll = () => setExpanded(new Set());

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term && !department) return [];
    return people
      .filter((p) => !department || String(p.department?._id) === department)
      .filter((p) => !term || [getFullName(p), p.email, p.employeeCode, p.designation?.title].some((v) => v?.toLowerCase().includes(term)))
      .slice(0, 30);
  }, [people, search, department]);

  return (
    <div>
      <PageHeader
        title="Org Chart"
        subtitle="Who reports to whom across the company"
        actions={
          <>
            {meId && tree.byId.has(meId) && (
              <Button variant="secondary" icon={LocateFixed} onClick={() => focusPerson(meId)}>
                My position
              </Button>
            )}
            <Button variant="secondary" icon={ChevronsUpDown} onClick={expandAll}>
              Expand all
            </Button>
            <Button variant="secondary" icon={ChevronsDownUp} onClick={collapseAll}>
              Collapse all
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input className="form-control pl-9" placeholder="Find a person, code or designation" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select
          className="sm:w-56"
          placeholder="All departments"
          options={(departments.data || []).map((d) => ({ value: d._id, label: d.name }))}
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
      </div>

      {(search.trim() || department) && (
        <Card className="mb-4">
          {matches.length ? (
            <div className="flex flex-wrap gap-2">
              {matches.map((p) => (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => focusPerson(String(p._id))}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 text-sm text-slate-700 hover:border-brand-300 hover:bg-brand-50"
                >
                  <Avatar name={getFullName(p)} src={p.avatar} size="sm" className="!h-6 !w-6 !text-[10px]" />
                  {getFullName(p)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No one matches your search.</p>
          )}
        </Card>
      )}

      <ErrorMessage message={error} onRetry={refetch} />
      {loading && !data && <PageLoader />}
      {data && !people.length && <EmptyState message="No active employees yet" />}

      {tree.leads.length > 0 && (
        <ul className="space-y-3">
          {tree.leads.map((node) => (
            <PersonNode key={node.id} node={node} depth={0} expanded={expanded} onToggle={toggle} highlight={highlight} meId={meId} canEdit={isHR} />
          ))}
        </ul>
      )}

      {tree.unassigned.length > 0 && (
        <Card className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <UserX className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">No reporting manager</h2>
            <Badge status="pending">{tree.unassigned.length}</Badge>
          </div>
          {isHR && <p className="mb-3 text-xs text-slate-500">Assign a reporting manager so these people appear in the right team.</p>}
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {tree.unassigned.map((node) => (
              <PersonNode key={node.id} node={node} depth={0} expanded={expanded} onToggle={toggle} highlight={highlight} meId={meId} canEdit={isHR} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
