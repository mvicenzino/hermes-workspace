/**
 * Paperclip dashboard widgets — projects, issues, activity from Paperclip orchestration.
 * Gracefully hides when Paperclip is unavailable.
 */
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  fetchPaperclipIssues,
  fetchPaperclipProjects,
  fetchPaperclipRuns,
  fetchPaperclipActivity,
} from '@/lib/paperclip-api'
import type {
  PaperclipIssue,
  PaperclipProject,
  PaperclipRun,
  PaperclipActivity,
} from '@/lib/paperclip-api'
import { cn } from '@/lib/utils'

// ── Query keys ────────────────────────────────────────────────────

const PAPERCLIP_KEYS = {
  issues: ['paperclip', 'issues'] as const,
  projects: ['paperclip', 'projects'] as const,
  runs: ['paperclip', 'runs'] as const,
  activity: ['paperclip', 'activity'] as const,
}

// ── Shared components (match dashboard-screen patterns) ──────────

function PaperclipCard({
  title,
  accentColor,
  children,
  className,
}: {
  title: string
  accentColor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(
      'relative flex flex-col overflow-hidden rounded-xl border transition-colors',
      className,
    )} style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}>
      {accentColor && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}50, transparent)` }}
        />
      )}
      <div className="flex items-center justify-between px-5 pt-4 pb-0">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">{title}</h3>
      </div>
      <div className="flex-1 px-5 pb-4 pt-3">{children}</div>
    </div>
  )
}

function PaperclipMetricTile({ label, value, icon, accentColor }: {
  label: string; value: string; icon: string; accentColor: string
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border transition-colors"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}50, transparent)` }}
      />
      <div className="flex items-start justify-between px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">{label}</div>
          <div className="text-2xl font-bold tabular-nums text-ink">{value}</div>
        </div>
        <div className="flex size-8 items-center justify-center rounded-lg text-base"
          style={{ background: `${accentColor}15` }}>{icon}</div>
      </div>
    </div>
  )
}

// ── Status helpers ────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  todo: '#3b82f6',
  in_progress: '#f59e0b',
  in_review: '#a855f7',
  done: '#22c55e',
  blocked: '#ef4444',
  backlog: '#6b7280',
  cancelled: '#6b7280',
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#6b7280',
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6b7280'
  return <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
}

function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] || '#6b7280'
  return (
    <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
      style={{ background: `${color}20`, color }}>
      {priority}
    </span>
  )
}

function timeAgo(ts: string | number): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Metrics Row ───────────────────────────────────────────────────

export function PaperclipMetrics() {
  const issuesQuery = useQuery({
    queryKey: PAPERCLIP_KEYS.issues,
    queryFn: () => fetchPaperclipIssues('backlog,todo,in_progress,in_review,blocked'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  })

  const projectsQuery = useQuery({
    queryKey: PAPERCLIP_KEYS.projects,
    queryFn: fetchPaperclipProjects,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  })

  const runsQuery = useQuery({
    queryKey: PAPERCLIP_KEYS.runs,
    queryFn: () => fetchPaperclipRuns(50),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  })

  const issues = issuesQuery.data ?? []
  const projects = projectsQuery.data ?? []
  const runs = runsQuery.data ?? []

  const inProgress = issues.filter(i => i.status === 'in_progress').length
  const openCount = issues.filter(i => ['todo', 'in_progress', 'in_review'].includes(i.status)).length

  // If all queries failed, Paperclip is likely unavailable — hide entirely
  if (issuesQuery.isError && projectsQuery.isError && runsQuery.isError) return null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <PaperclipMetricTile label="Projects" value={String(projects.length)} icon="📋" accentColor="#ec4899" />
      <PaperclipMetricTile label="Open Issues" value={String(openCount)} icon="📌" accentColor="#14b8a6" />
      <PaperclipMetricTile label="In Progress" value={String(inProgress)} icon="⚡" accentColor="#f59e0b" />
      <PaperclipMetricTile label="Agent Runs" value={String(runs.length)} icon="🤖" accentColor="#8b5cf6" />
    </div>
  )
}

// ── Issues Widget ─────────────────────────────────────────────────

export function PaperclipIssuesWidget() {
  const { data, isError } = useQuery({
    queryKey: PAPERCLIP_KEYS.issues,
    queryFn: () => fetchPaperclipIssues('todo,in_progress,in_review,blocked'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  })

  if (isError) return null

  const issues = (data ?? []).slice(0, 8)

  return (
    <PaperclipCard title="Paperclip Issues" accentColor="#14b8a6">
      {issues.length === 0 ? (
        <div className="text-xs text-muted py-6 text-center">No open issues</div>
      ) : (
        <div className="space-y-1">
          {issues.map((issue: PaperclipIssue) => (
            <div key={issue.id}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-[var(--theme-hover)] transition-colors">
              <StatusDot status={issue.status} />
              <span className="text-[10px] font-mono text-muted shrink-0">{issue.identifier}</span>
              <span className="text-xs text-ink truncate flex-1">{issue.title}</span>
              <PriorityBadge priority={issue.priority} />
            </div>
          ))}
        </div>
      )}
    </PaperclipCard>
  )
}

// ── Activity Widget ───────────────────────────────────────────────

export function PaperclipActivityWidget() {
  const { data, isError } = useQuery({
    queryKey: PAPERCLIP_KEYS.activity,
    queryFn: () => fetchPaperclipActivity(10),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  })

  // Fall back to showing recent runs if activity endpoint fails
  const runsQuery = useQuery({
    queryKey: [...PAPERCLIP_KEYS.runs, 'activity-fallback'],
    queryFn: () => fetchPaperclipRuns(8),
    staleTime: 30_000,
    enabled: isError,
    retry: false,
  })

  if (isError && runsQuery.isError) return null

  const activity = data ?? []
  const runs = runsQuery.data ?? []

  // If we have activity data, show it; otherwise show runs
  if (activity.length > 0) {
    return (
      <PaperclipCard title="Paperclip Activity" accentColor="#8b5cf6">
        <div className="space-y-1">
          {activity.map((item: PaperclipActivity) => {
            const label = item.action.replace(/\./g, ' ').replace(/_/g, ' ')
            const title = item.details?.issueTitle || item.details?.agentName || ''
            const id = item.details?.identifier || ''
            return (
              <div key={item.id} className="flex items-start gap-2.5 rounded-lg px-3 py-2">
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--theme-accent)] mt-1.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-ink truncate">
                    {id && <span className="font-mono text-muted mr-1">{id}</span>}
                    {title || label}
                  </p>
                  <p className="text-[10px] text-muted">
                    <span className="capitalize">{label}</span>
                    {' · '}
                    {timeAgo(item.createdAt)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </PaperclipCard>
    )
  }

  // Fallback: show recent runs
  return (
    <PaperclipCard title="Recent Agent Runs" accentColor="#8b5cf6">
      {runs.length === 0 ? (
        <div className="text-xs text-muted py-6 text-center">No recent runs</div>
      ) : (
        <div className="space-y-1">
          {runs.map((run: PaperclipRun) => (
            <div key={run.id} className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-[var(--theme-hover)] transition-colors">
              <span className={cn(
                'size-2 shrink-0 rounded-full',
                run.status === 'completed' || run.status === 'success' ? 'bg-emerald-500' :
                run.status === 'running' ? 'bg-amber-500 animate-pulse' : 'bg-neutral-500',
              )} />
              <span className="text-xs text-ink truncate flex-1">
                {run.agentName || 'Agent'} — {run.result ? run.result.slice(0, 60) : run.status || 'run'}
              </span>
              {run.durationMs != null && (
                <span className="text-[10px] text-muted tabular-nums">
                  {run.durationMs > 60000 ? `${(run.durationMs / 60000).toFixed(1)}m` : `${(run.durationMs / 1000).toFixed(0)}s`}
                </span>
              )}
              {run.startedAt && (
                <span className="text-[10px] text-muted">{timeAgo(run.startedAt)}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </PaperclipCard>
  )
}

// ── Combined Section ──────────────────────────────────────────────

export function PaperclipSection() {
  return (
    <>
      {/* Section Header */}
      <div className="flex items-center gap-3 pt-2">
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">Paperclip</span>
        <div className="flex-1 border-t border-[var(--theme-border)]" />
      </div>

      {/* Metrics */}
      <PaperclipMetrics />

      {/* Issues + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-7">
          <PaperclipIssuesWidget />
        </div>
        <div className="lg:col-span-5">
          <PaperclipActivityWidget />
        </div>
      </div>
    </>
  )
}
