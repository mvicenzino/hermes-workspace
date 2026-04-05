/**
 * Hermes Config API — read/write ~/.hermes/config.yaml and ~/.hermes/.env
 * Gives the web UI the same config power as `hermes setup`
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createFileRoute } from '@tanstack/react-router'
import YAML from 'yaml'
import { createCapabilityUnavailablePayload } from '@/lib/feature-gates'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  HERMES_API,
  BEARER_TOKEN,
  ensureGatewayProbed,
  getCapabilities,
} from '../../server/gateway-capabilities'

type AuthResult = Response | true

const HERMES_HOME = path.join(os.homedir(), '.hermes')
const CONFIG_PATH = path.join(HERMES_HOME, 'config.yaml')
const ENV_PATH = path.join(HERMES_HOME, '.env')

// Known Hermes providers
const PROVIDERS = [
  { id: 'nous', name: 'Nous Portal', authType: 'oauth', envKeys: [] },
  { id: 'openai-codex', name: 'OpenAI Codex', authType: 'oauth', envKeys: [] },
  { id: 'anthropic', name: 'Anthropic', authType: 'api_key', envKeys: ['ANTHROPIC_API_KEY'] },
  { id: 'openrouter', name: 'OpenRouter', authType: 'api_key', envKeys: ['OPENROUTER_API_KEY'] },
  { id: 'zai', name: 'Z.AI / GLM', authType: 'api_key', envKeys: ['GLM_API_KEY'] },
  { id: 'kimi-coding', name: 'Kimi / Moonshot', authType: 'api_key', envKeys: ['KIMI_API_KEY'] },
  { id: 'minimax', name: 'MiniMax', authType: 'api_key', envKeys: ['MINIMAX_API_KEY'] },
  { id: 'minimax-cn', name: 'MiniMax (China)', authType: 'api_key', envKeys: ['MINIMAX_CN_API_KEY'] },
  { id: 'ollama', name: 'Ollama (Local)', authType: 'none', envKeys: [] },
  { id: 'custom', name: 'Custom OpenAI-compatible', authType: 'api_key', envKeys: [] },
]

function readConfig(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return (YAML.parse(raw) as Record<string, unknown>) || {}
  } catch {
    return {}
  }
}

function writeConfig(config: Record<string, unknown>): void {
  fs.mkdirSync(HERMES_HOME, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, YAML.stringify(config), 'utf-8')
}

function readEnv(): Record<string, string> {
  try {
    const raw = fs.readFileSync(ENV_PATH, 'utf-8')
    const env: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        // Strip quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        env[key] = value
      }
    }
    return env
  } catch {
    return {}
  }
}

function writeEnv(env: Record<string, string>): void {
  fs.mkdirSync(HERMES_HOME, { recursive: true })
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`)
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8')
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return '***'
  return key.slice(0, 4) + '...' + key.slice(-4)
}

function checkAuthStore(providerId: string): { hasToken: boolean; source: string; maskedKey?: string } {
  // Check Hermes auth store
  for (const storePath of [
    path.join(os.homedir(), '.hermes', 'auth-profiles.json'),
    path.join(os.homedir(), '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json'),
  ]) {
    try {
      if (!fs.existsSync(storePath)) continue
      const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
      const profiles = store?.profiles || {}
      for (const [key, value] of Object.entries(profiles)) {
        if (!key.startsWith(`${providerId}:`)) continue
        if (typeof value !== 'object' || value === null) continue
        const p = value as Record<string, unknown>
        const token = String(p.token || p.key || p.access || '').trim()
        if (token) {
          const source = storePath.includes('.hermes') ? 'hermes-auth-store' : 'openclaw-auth-store'
          return { hasToken: true, source, maskedKey: maskKey(token) }
        }
      }
    } catch {}
  }
  return { hasToken: false, source: '' }
}

export const Route = createFileRoute('/api/hermes-config')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authResult = isAuthenticated(request) as AuthResult
        if (authResult !== true) return authResult
        await ensureGatewayProbed()
        if (!getCapabilities().config) {
          return Response.json({
            ...createCapabilityUnavailablePayload('config'),
            config: {},
            providers: [],
            activeProvider: '',
            activeModel: '',
            hermesHome: HERMES_HOME,
          })
        }

        let config = readConfig()
        const env = readEnv()

        // If local config is empty (e.g. running on Vercel without local filesystem),
        // fetch the active model from the agent's latest session
        const hasLocalConfig = Object.keys(config).length > 0
        let remoteModel = ''
        let remoteProvider = ''
        if (!hasLocalConfig && HERMES_API) {
          try {
            const headers: Record<string, string> = {}
            if (BEARER_TOKEN) headers['Authorization'] = `Bearer ${BEARER_TOKEN}`
            const res = await fetch(`${HERMES_API}/api/sessions?limit=1`, {
              headers,
              signal: AbortSignal.timeout(8_000),
            })
            if (res.ok) {
              const data = await res.json() as { items?: Array<{ model?: string }> }
              const latest = data.items?.[0]
              if (latest?.model) {
                remoteModel = latest.model
                // Infer provider from model name prefix
                if (remoteModel.startsWith('google/')) remoteProvider = 'google'
                else if (remoteModel.startsWith('anthropic/') || remoteModel.startsWith('claude')) remoteProvider = 'anthropic'
                else if (remoteModel.startsWith('openai/') || remoteModel.startsWith('gpt')) remoteProvider = 'openai'
                else if (remoteModel.includes('/')) remoteProvider = remoteModel.split('/')[0]
              }
            }
          } catch {
            // Agent unreachable — fall through with empty config
          }
        }

        // Build provider status
        const providerStatus = PROVIDERS.map((p) => {
          const hasEnvKey = p.envKeys.length === 0 || p.envKeys.some((k) => !!env[k])
          const authStoreCheck = checkAuthStore(p.id)
          const hasKey = hasEnvKey || authStoreCheck.hasToken || p.authType === 'none'
          const maskedKeys: Record<string, string> = {}
          for (const k of p.envKeys) {
            if (env[k]) maskedKeys[k] = maskKey(env[k])
          }
          if (authStoreCheck.hasToken && authStoreCheck.maskedKey) {
            maskedKeys['auth-store'] = authStoreCheck.maskedKey
          }
          return {
            ...p,
            configured: hasKey,
            authSource: authStoreCheck.hasToken ? authStoreCheck.source : (hasEnvKey ? 'env' : 'none'),
            maskedKeys,
          }
        })

        // Get active provider/model from config
        // Support both flat keys (model: "gpt-5.4", provider: "openai-codex")
        // and legacy nested format (model: { default: "...", provider: "..." })
        const modelField = config.model
        let activeModel = ''
        let activeProvider = ''
        if (typeof modelField === 'string') {
          activeModel = modelField
          activeProvider = (config.provider as string) || ''
        } else if (modelField && typeof modelField === 'object') {
          const modelObj = modelField as Record<string, unknown>
          activeModel = (modelObj.default as string) || ''
          activeProvider = (modelObj.provider as string) || (config.provider as string) || ''
        }

        // Fall back to remote model info if local config was empty
        if (!activeModel && remoteModel) {
          activeModel = remoteModel
          activeProvider = activeProvider || remoteProvider
        }

        return Response.json({
          config,
          providers: providerStatus,
          activeProvider,
          activeModel,
          hermesHome: HERMES_HOME,
        })
      },

      PATCH: async ({ request }) => {
        const authResult = isAuthenticated(request) as AuthResult
        if (authResult !== true) return authResult
        await ensureGatewayProbed()
        if (!getCapabilities().config) {
          return new Response(
            JSON.stringify(
              createCapabilityUnavailablePayload('config', {
                error: 'Configuration updates are unavailable on this backend.',
              }),
            ),
            { status: 503, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const body = (await request.json()) as Record<string, unknown>

        // Handle config updates
        if (body.config && typeof body.config === 'object') {
          const current = readConfig()
          const updates = body.config as Record<string, unknown>

          // Deep merge
          function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
            for (const [key, value] of Object.entries(source)) {
              if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object') {
                deepMerge(target[key] as Record<string, unknown>, value as Record<string, unknown>)
              } else {
                target[key] = value
              }
            }
          }

          // Handle null values as explicit removals
          for (const [key, value] of Object.entries(updates)) {
            if (value === null) {
              delete current[key]
              delete updates[key]
            }
          }
          deepMerge(current, updates)
          writeConfig(current)
        }

        // Handle env var updates
        if (body.env && typeof body.env === 'object') {
          const currentEnv = readEnv()
          const envUpdates = body.env as Record<string, string>
          for (const [key, value] of Object.entries(envUpdates)) {
            if (value === '' || value === null) {
              delete currentEnv[key]
            } else {
              currentEnv[key] = value
            }
          }
          writeEnv(currentEnv)
        }

        return Response.json({ ok: true, message: 'Config updated. Restart Hermes to apply changes.' })
      },
    },
  },
})
