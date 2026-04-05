/**
 * Paperclip API client — talks to /api/paperclip proxy route.
 */

const API = '/api/paperclip'

// ── Types ─────────────────────────────────────────────────────────

export type PaperclipIssue = {
  id: string
  identifier: string
  title: string
  description?: string
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | 'cancelled'
  priority: 'critical' | 'high' | 'medium' | 'low'
  assigneeAgentId?: string | null
  projectId?: string | null
  parentId?: string | null
  createdAt?: string
  updatedAt?: string
}

export type PaperclipAgent = {
  id: string
  name: string
  role?: string
  status?: string
  lastHeartbeat?: string
}

export type PaperclipProject = {
  id: string
  name: string
  description?: string
  issueCount?: number
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

export async function fetchPaperclipIssues(status?: string): Promise<PaperclipIssue[]> {
  const params: Record<string, string> = {}
  if (status) params.status = status
  const data = await paperclipFetch<{ issues?: PaperclipIssue[]; items?: PaperclipIssue[] }>('issues', params)
  return data.issues ?? data.items ?? []
}

export async function fetchPaperclipAgents(): Promise<PaperclipAgent[]> {
  const data = await paperclipFetch<{ agents?: PaperclipAgent[]; items?: PaperclipAgent[] }>('agents')
  return data.agents ?? data.items ?? []
}

export async function fetchPaperclipProjects(): Promise<PaperclipProject[]> {
  const data = await paperclipFetch<{ projects?: PaperclipProject[]; items?: PaperclipProject[] }>('projects')
  return data.projects ?? data.items ?? []
}

export async function fetchPaperclipRuns(limit = 10): Promise<PaperclipRun[]> {
  const data = await paperclipFetch<{ runs?: PaperclipRun[]; items?: PaperclipRun[] }>('runs', { limit: String(limit) })
  return data.runs ?? data.items ?? []
}

export async function fetchPaperclipActivity(limit = 20): Promise<PaperclipActivity[]> {
  const data = await paperclipFetch<{ activity?: PaperclipActivity[]; items?: PaperclipActivity[] }>('activity', { limit: String(limit) })
  return data.activity ?? data.items ?? []
}

export async function fetchPaperclipDashboard(): Promise<Record<string, unknown>> {
  return paperclipFetch<Record<string, unknown>>('dashboard')
}
