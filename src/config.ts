import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { z } from 'zod'

const sourceRepoSelectionSchema = z.object({
  mode: z.enum(['all', 'selected']),
  selected: z.array(z.string()).default([]),
  excludeForks: z.boolean().optional(),
  visibility: z.enum(['all', 'public', 'private']).optional(),
})

const sourceSchema = z.object({
  type: z.enum(['org', 'user', 'repo']),
  value: z.string().min(1),
  repos: sourceRepoSelectionSchema.optional(),
})

const configSchema = z.object({
  sources: z.array(sourceSchema).min(1),
  excludedRepos: z.array(z.string()).default([]),
  digest: z.object({ topN: z.number().int().positive().default(10) }).default({ topN: 10 }),
  dispatch: z
    .object({ agent: z.enum(['claude', 'copilot']).default('claude') })
    .default({ agent: 'claude' }),
  notifications: z
    .object({
      // Slack incoming webhook. The URL is a secret (env SIGNALS_SLACK_WEBHOOK);
      // the channel is whatever that webhook posts to. `channel` here is a label.
      slack: z
        .object({ enabled: z.boolean().default(false), channel: z.string().default('') })
        .default({ enabled: false, channel: '' }),
      // Email digest. SMTP credentials are a secret (env SIGNALS_SMTP_URL).
      email: z
        .object({
          enabled: z.boolean().default(false),
          to: z.string().default(''),
          from: z.string().default(''),
        })
        .default({ enabled: false, to: '', from: '' }),
    })
    .default({
      slack: { enabled: false, channel: '' },
      email: { enabled: false, to: '', from: '' },
    }),
})

export type SignalsConfig = z.infer<typeof configSchema>

const CONFIG_PATHS = ['signals.config.yml', 'signals.config.yaml', 'signals.config.json']

export function loadConfig(explicitPath?: string): SignalsConfig {
  const path =
    explicitPath ?? CONFIG_PATHS.find((p) => existsSync(resolve(process.cwd(), p)))
  if (!path) {
    throw new Error(
      `No config found. Create signals.config.yml (looked for: ${CONFIG_PATHS.join(', ')}).`,
    )
  }
  const raw = readFileSync(resolve(process.cwd(), path), 'utf-8')
  // js-yaml parses both YAML and JSON (YAML is a superset).
  const parsed = configSchema.safeParse(yaml.load(raw))
  if (!parsed.success) {
    throw new Error(`Invalid ${path}:\n${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}
