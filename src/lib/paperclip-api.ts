/**
 * Paperclip API client — talks to /api/paperclip proxy route.
 */

const API = '/api/paperclip'

// ── Types ─────────────────────────────────────────────────────────

export type PaperclipIssue = {
  id: string
  companyId: string
  identifier: string
  issueNumber: number
  title: string
  description?: string | null
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'cancelled'
  priority: 'critical' | 'high' | 'medium' | 'low'
  assigneeAgentId?: string | null
  projectId?: string | null
  parentId?: string | null
  completedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

export type PaperclipAgent = {
  id: string
  companyId: string
  name: string
  role?: string
  title?: string
  icon?: string | null
  status?: string
  capabilities?: string
  adapterType?: string
  adapterConfig?: Record<string, unknown>
  runtimeConfig?: {
    heartbeat?: {
      enabled?: boolean
      intervalSec?: number
    }
  }
  lastHeartbeatAt?: string | null
  urlKey?: string
  createdAt?: string
  updatedAt?: string
}

export type PaperclipProject = {
  id: string
  name: string
  description?: string
  issueCount?: number
}

export type PaperclipDashboardStats = {
  agents: { active: number; running: number; paused: number; error: number }
  tasks: { open: number; inProgress: number; blocked: number; done: number }
  costs: { monthSpendCents: number; monthBudgetCents: number }
  pendingApprovals: number
}

export type PaperclipRun = {
  id: string
  agentId?: string
  agentName?: string
  status?: string
  startedAt?: string
  completedAt?: string
  durationMs?: number
  issueCount?: number
  result?: string
}

export type PaperclipActivity = {
  id: string
  type: string
  message: string
  timestamp: string
  actorName?: string
  actorType?: 'agent' | 'user'
}

// ── Fetch helpers ─────────────────────────────────────────────────

async function paperclipFetch<T>(sub: string, params?: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ sub, ...params })
  const res = await fetch(`${API}?${qs.toString()}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as Record<string, string>).error || `Paperclip error: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ── Public API ────────────────────────────────────────────────────

// Paperclip returns flat arrays for list endpoints, or wrapped objects — handle both
function unwrap<T>(data: unknown, keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    for (const k of keys) {
      const val = (data as Record<string, unknown>)[k]
      if (Array.isArray(val)) return val as T[]
    }
  }
  return []
}

export async function fetchPaperclipIssues(status?: string): Promise<PaperclipIssue[]> {
  const params: Record<string, string> = {}
  if (status) params.status = status
  const data = await paperclipFetch<unknown>('issues', params)
  return unwrap<PaperclipIssue>(data, ['issues', 'items'])
}

export async function fetchPaperclipAgents(): Promise<PaperclipAgent[]> {
  const data = await paperclipFetch<unknown>('agents')
  return unwrap<PaperclipAgent>(data, ['agents', 'items'])
}

export async function fetchPaperclipProjects(): Promise<PaperclipProject[]> {
  const data = await paperclipFetch<unknown>('projects')
  return unwrap<PaperclipProject>(data, ['projects', 'items'])
}

export async function fetchPaperclipRuns(limit = 10): Promise<PaperclipRun[]> {
  const data = await paperclipFetch<unknown>('runs', { limit: String(limit) })
  return unwrap<PaperclipRun>(data, ['runs', 'items'])
}

export async function fetchPaperclipActivity(limit = 20): Promise<PaperclipActivity[]> {
  const data = await paperclipFetch<unknown>('activity', { limit: String(limit) })
  return unwrap<PaperclipActivity>(data, ['activity', 'items'])
}

export async function fetchPaperclipDashboard(): Promise<PaperclipDashboardStats> {
  return paperclipFetch<PaperclipDashboardStats>('dashboard')
}
