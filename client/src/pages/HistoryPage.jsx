import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, FileText, PlayCircle, ChevronRight, History } from 'lucide-react';
import { useAsync, useDocumentTitle } from '../hooks/useAsync';
import { useToast } from '../context/ToastContext';
import { Button, IconButton } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Field';
import { ScorePill } from '../components/ui/Metrics';
import { ConfirmDialog } from '../components/ui/Dialog';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { PageContainer, PageHeader } from '../components/layout/PageHeader';
import { TOPIC_SHORT } from '../lib/constants';
import { formatDate, STATUS_META, END_REASON_LABEL } from '../lib/format';
import api from '../services/api';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'finished', label: 'Finished', match: (i) => ['completed', 'terminated'].includes(i.status) },
  { id: 'active', label: 'Not finished', match: (i) => ['created', 'in_progress'].includes(i.status) },
  { id: 'terminated', label: 'Ended early', match: (i) => i.status === 'terminated' },
];

export const HistoryPage = () => {
  useDocumentTitle('Interviews');
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data, loading, error, reload, setData } = useAsync(async () => (await api.get('/interviews/history')).interviews, []);

  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter);
    const q = query.trim().toLowerCase();
    return (data || []).filter(
      (i) =>
        (!f?.match || f.match(i)) &&
        (!q || i.title.toLowerCase().includes(q) || i.topics?.some((t) => t.toLowerCase().includes(q)))
    );
  }, [data, filter, query]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/interviews/${toDelete._id}`);
      setData((data || []).filter((i) => i._id !== toDelete._id));
      toast.success('Interview deleted.');
      setToDelete(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageContainer size="lg">
      <PageHeader
        eyebrow="Interviews"
        title="All interviews"
        description="Every session you’ve created, with scores and reports."
        actions={
          <Button as={Link} to="/interviews/new" icon={Plus}>
            New interview
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1 scrollbar-none" role="tablist" aria-label="Filter interviews">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.id ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sm:w-64">
          <Input icon={Search} placeholder="Search by title or topic" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search interviews" />
        </div>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading ? (
        <div className="card divide-y divide-line">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-5">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
      ) : (data || []).length === 0 ? (
        <Card>
          <EmptyState
            icon={History}
            title="No interviews yet"
            description="Your interviews and reports will be listed here."
            action={
              <Button as={Link} to="/interviews/new" icon={Plus}>
                Create your first interview
              </Button>
            }
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="No matches" description="Try a different filter or search term." />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {rows.map((item) => {
              const meta = STATUS_META[item.status] || STATUS_META.created;
              const finished = ['completed', 'terminated'].includes(item.status);
              const to = finished ? `/interviews/${item._id}/results` : `/interviews/${item._id}/${item.status === 'in_progress' ? 'room' : 'prep'}`;
              return (
                <li key={item._id} className="flex items-center gap-2 pr-3 hover:bg-surface-2/50">
                  <Link to={to} className="flex min-w-0 flex-1 items-center gap-4 py-4 pl-5 sm:pl-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="line-clamp-2 text-sm font-semibold text-ink">{item.title}</p>
                        <Badge tone={meta.tone} size="sm" dot>
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-3">
                        {formatDate(item.completedAt || item.createdAt)} · {item.topics?.map((t) => TOPIC_SHORT[t] || t).join(', ')} · {item.answeredCount}/{item.questionCount} answered
                        {item.endReason && item.endReason !== 'all_answered' && item.status === 'completed' ? ` · ${END_REASON_LABEL[item.endReason]}` : ''}
                      </p>
                    </div>
                    <span className="w-12 text-right">
                      {finished ? (
                        <ScorePill score={item.overallScore} />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink">
                          <PlayCircle className="h-4 w-4" aria-hidden="true" /> {item.status === 'in_progress' ? 'Resume' : 'Start'}
                        </span>
                      )}
                    </span>
                    {finished ? <FileText className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" aria-hidden="true" />}
                  </Link>
                  <IconButton label={`Delete ${item.title}`} icon={Trash2} onClick={() => setToDelete(item)} className="shrink-0 hover:text-danger" />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        isLoading={deleting}
        tone="danger"
        title="Delete this interview?"
        description={toDelete ? `“${toDelete.title}” and its answers, scores and proctoring log will be permanently deleted.` : ''}
        confirmLabel="Delete"
      />
    </PageContainer>
  );
};

export default HistoryPage;
