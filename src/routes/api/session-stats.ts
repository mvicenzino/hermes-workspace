/**
 * Session stats API — reads session files from ~/.hermes/sessions/ on disk
 * to provide accurate daily activity counts including Telegram, cron, CLI.
 * The in-memory sessions API only has current-boot data.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'

const SESSIONS_DIR = path.join(os.homedir(), '.hermes', 'sessions')

type DayStats = {
  date: string
  sessions: number
  messages: number
  sources: Record<string, number>
}

function getSessionStats(days = 14): DayStats[] {
  const dayMap = new Map<string, { sessions: number; messages: number; sources: Record<string, number> }>()

  // Pre-fill last N days
  const now = Date.now()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86400000)
    const key = d.toISOString().slice(0, 10)
    dayMap.set(key, { sessions: 0, messages: 0, sources: {} })
  }

  try {
    const files = fs.readdirSync(SESSIONS_DIR)
    for (const file of files) {
      if (!file.startsWith('session_') || !file.endsWith('.json')) continue
      try {
        const raw = fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8')
        const s = JSON.parse(raw)
        const ts = s.session_start || s.started_at
        if (!ts) continue

        let day: string
        if (typeof ts === 'string') {
          day = ts.slice(0, 10)
        } else {
          day = new Date(ts * 1000).toISOString().slice(0, 10)
        }

        const entry = dayMap.get(day)
        if (!entry) continue // outside range

        const source = s.source || s.platform || 'unknown'
        entry.sessions++
        entry.messages += s.message_count || 0
        entry.sources[source] = (entry.sources[source] || 0) + 1
      } catch {
        // skip malformed files
      }
    }
  } catch {
    // sessions dir doesn't exist
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }))
}

export const Route = createFileRoute('/api/session-stats')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }
        const url = new URL(request.url)
        const days = Math.min(parseInt(url.searchParams.get('days') || '14', 10), 90)
        const stats = getSessionStats(days)
        return new Response(JSON.stringify({ stats }), {
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
