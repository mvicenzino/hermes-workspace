/**
 * Paperclip API proxy — forwards to Paperclip orchestration server.
 * Uses ?sub= query param to dispatch to the correct endpoint.
 */
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'

const PAPERCLIP_API = process.env.PAPERCLIP_API_URL || 'http://127.0.0.1:3100'
const PAPERCLIP_KEY = process.env.PAPERCLIP_API_KEY || ''
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID || 'fb54ec1a-f548-49ca-898b-b5c72b97260d'

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (PAPERCLIP_KEY) headers['Authorization'] = `Bearer ${PAPERCLIP_KEY}`
  return headers
}

const SUB_ROUTES: Record<string, (params: URLSearchParams) => string> = {
  dashboard: () => `/api/companies/${COMPANY_ID}/dashboard`,
  issues: (p) => {
    const status = p.get('status') || 'todo,in_progress,in_review,blocked'
    const q = p.get('q') || ''
    const qs = [`status=${status}`]
    if (q) qs.push(`q=${encodeURIComponent(q)}`)
    return `/api/companies/${COMPANY_ID}/issues?${qs.join('&')}`
  },
  agents: () => `/api/companies/${COMPANY_ID}/agents`,
  projects: () => `/api/companies/${COMPANY_ID}/projects`,
  runs: (p) => {
    const limit = p.get('limit') || '10'
    return `/api/companies/${COMPANY_ID}/heartbeat-runs?limit=${limit}`
  },
  activity: (p) => {
    const limit = p.get('limit') || '20'
    return `/api/companies/${COMPANY_ID}/activity?limit=${limit}`
  },
}

export const Route = createFileRoute('/api/paperclip')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }

        const url = new URL(request.url)
        const sub = url.searchParams.get('sub')

        if (!sub || !SUB_ROUTES[sub]) {
          return new Response(
            JSON.stringify({ error: `Invalid sub route: ${sub}. Valid: ${Object.keys(SUB_ROUTES).join(', ')}` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const path = SUB_ROUTES[sub](url.searchParams)
        const target = `${PAPERCLIP_API}${path}`

        try {
          const res = await fetch(target, {
            headers: authHeaders(),
            signal: AbortSignal.timeout(10_000),
          })
          const data = await res.text()
          return new Response(data, {
            status: res.status,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch {
          return new Response(
            JSON.stringify({ error: 'Paperclip server unreachable', target }),
            { status: 502, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
