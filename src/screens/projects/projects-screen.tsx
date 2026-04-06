/**
 * Projects screen — Paperclip issue board + agent status.
 * Follows the same patterns as jobs-screen.tsx.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import ReactMarkdown from 'react-markdown'
import {
  fetchPaperclipIssues,
  fetchPaperclipAgents,
} from '@/lib/paperclip-api'
import type { PaperclipIssue, PaperclipAgent } from '@/lib/paperclip-api'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────

const QUERY_KEY_ISSUES = ['paperclip', 'issues', 'all']
const QUERY_KEY_AGENTS = ['paperclip', 'agents']

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'in_review', label: 'In Review' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
] as const

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

const AGENT_STATUS_COLORS: Record<string, string> = {
  idle: '#22c55e',
  running: '#f59e0b',
  pending_approval: '#a855f7',
  paused: '#6b7280',
  error: '#ef4444',
}

// ── Helpers ───────────────────────────────────────────────────────

function timeAgo(ts: string | undefined | null): string {
  if (!ts) return ''
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Status/Priority Components ────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6b7280'
  return <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6b7280'
  const label = status.replace(/_/g, ' ')
  return (
    <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
      style={{ background: `${color}20`, color }}>
      {label}
    </span>
  )
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

// ── Agent Bar ─────────────────────────────────────────────────────

function AgentBar({ agents }: { agents: PaperclipAgent[] }) {
  if (agents.length === 0) return null
  return (
    <div className="flex items-center gap-4 rounded-xl border px-4 py-2.5"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">Agents</span>
      <div className="flex flex-wrap items-center gap-3">
        {agents.map((agent) => {
          const color = AGENT_STATUS_COLORS[agent.status ?? 'idle'] || '#6b7280'
          return (
            <div key={agent.id} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: color }} />
              <span className="text-xs text-ink font-medium">{agent.name}</span>
              <span className="text-[10px] text-muted">{agent.role}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Issue Card ────────────────────────────────────────────────────

function IssueCard({
  issue,
  agentName,
  isExpanded,
  onToggle,
}: {
  issue: PaperclipIssue
  agentName?: string
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border overflow-hidden transition-colors"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}
    >
      {/* Card header — always visible */}
      <button
        type="button"
        className="w-full text-left px-4 py-3 hover:bg-[var(--theme-hover)] transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <StatusDot status={issue.status} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-muted">{issue.identifier}</span>
              <PriorityBadge priority={issue.priority} />
              <StatusBadge status={issue.status} />
            </div>
            <h4 className="text-sm font-medium text-ink leading-snug">{issue.title}</h4>
            {!isExpanded && issue.description && (
              <p className="text-xs text-muted mt-1 line-clamp-2">{issue.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted">
              {agentName && (
                <span className="flex items-center gap-1">
                  <span>🤖</span> {agentName}
                </span>
              )}
              {issue.createdAt && <span>{timeAgo(issue.createdAt)}</span>}
              {issue.completedAt && (
                <span className="text-emerald-500">✓ completed {timeAgo(issue.completedAt)}</span>
              )}
            </div>
          </div>
          <span className={cn(
            'text-muted text-xs transition-transform',
            isExpanded && 'rotate-180',
          )}>▼</span>
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {isExpanded && issue.description && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: 'var(--theme-border)' }}>
              <div className="prose prose-sm prose-invert max-w-none text-xs text-[var(--theme-text)]
                [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_p]:text-xs [&_li]:text-xs
                [&_strong]:text-[var(--theme-text)] [&_a]:text-[var(--theme-accent)]
                [&_code]:text-[10px] [&_code]:bg-[var(--theme-card2)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
                <ReactMarkdown>{issue.description}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main Screen ───────────────────────────────────────────────────

export function ProjectsScreen() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const issuesQuery = useQuery({
    queryKey: QUERY_KEY_ISSUES,
    queryFn: () => fetchPaperclipIssues('backlog,todo,in_progress,in_review,blocked,done,cancelled'),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  })

  const agentsQuery = useQuery({
    queryKey: QUERY_KEY_AGENTS,
    queryFn: fetchPaperclipAgents,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  })

  const allIssues = issuesQuery.data ?? []
  const agents = agentsQuery.data ?? []

  // Build agent lookup for display
  const agentMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of agents) map.set(a.id, a.name)
    return map
  }, [agents])

  // Filter by tab + search
  const filteredIssues = useMemo(() => {
    let list = allIssues
    if (activeTab !== 'all') {
      list = list.filter(i => i.status === activeTab)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.identifier.toLowerCase().includes(q) ||
        (i.description?.toLowerCase().includes(q) ?? false),
      )
    }
    return list
  }, [allIssues, activeTab, search])

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allIssues.length }
    for (const i of allIssues) {
      counts[i.status] = (counts[i.status] ?? 0) + 1
    }
    return counts
  }, [allIssues])

  const isLoading = issuesQuery.isLoading
  const isError = issuesQuery.isError && agentsQuery.isError

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
        <div className="text-4xl">📋</div>
        <h2 className="text-sm font-semibold text-ink">Paperclip Unavailable</h2>
        <p className="text-xs text-muted max-w-sm">
          Could not connect to the Paperclip server. Make sure it&apos;s running with <code className="text-[10px] bg-[var(--theme-card2)] px-1.5 py-0.5 rounded">npx paperclipai run</code>
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-full px-4 py-4 md:px-8 md:py-6 lg:px-10 space-y-4 pb-28">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-ink">Projects</h1>
          {allIssues.length > 0 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
              style={{ background: 'var(--theme-accent)', color: 'white' }}>
              {allIssues.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ['paperclip'] })
          }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted border transition-colors hover:bg-[var(--theme-hover)]"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Agents Bar ── */}
      <AgentBar agents={agents} />

      {/* ── Status Tabs ── */}
      <div className="flex items-center gap-1 rounded-xl border px-1.5 py-1 overflow-x-auto"
        style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)' }}>
        {STATUS_TABS.map(tab => {
          const count = tabCounts[tab.key] ?? 0
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-[var(--theme-accent)] text-white shadow-sm'
                  : 'text-muted hover:text-ink hover:bg-[var(--theme-hover)]',
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0 text-[9px] font-bold tabular-nums',
                  isActive ? 'bg-white/20' : 'bg-[var(--theme-card2)]',
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search issues..."
          className="w-full rounded-xl border py-2.5 pl-9 pr-4 text-xs outline-none transition-colors focus:ring-1 focus:ring-[var(--theme-accent)]"
          style={{
            background: 'var(--theme-input)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        />
      </div>

      {/* ── Issue List ── */}
      {isLoading ? (
        <div className="text-xs text-muted text-center py-12">Loading issues...</div>
      ) : filteredIssues.length === 0 ? (
        <div className="text-xs text-muted text-center py-12">
          {search ? 'No issues match your search' : 'No issues found'}
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filteredIssues.map(issue => (
              <IssueCard
                key={issue.id}
                issue={issue}
                agentName={issue.assigneeAgentId ? agentMap.get(issue.assigneeAgentId) : undefined}
                isExpanded={expandedId === issue.id}
                onToggle={() => setExpandedId(prev => prev === issue.id ? null : issue.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
