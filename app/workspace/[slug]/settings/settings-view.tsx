'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Building2, GitBranch, Eye, EyeOff, Search, Pencil, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WorkspaceDialog } from '@/components/workspace/WorkspaceDialog'
import type { AgentOrchestratorConfig, AgentRunner, DispatchTarget, Workspace } from '@/types/workspace'

interface SettingsViewProps {
  workspace: Workspace
  allRepoNames: string[]
  canEdit: boolean
  agentOrchestratorTarget?: DispatchTarget
}

const runnerOptions: AgentRunner[] = ['codex', 'claude-code', 'cursor', 'opencode']

function defaultAoConfig(workspace: Workspace): AgentOrchestratorConfig {
  return {
    aoCommand: 'ao',
    aoCwd: '',
    projectId: workspace.slug,
    dashboardUrl: 'http://localhost:3000',
    defaultRunner: 'codex',
    allowedRunners: runnerOptions,
    runnerIdentity: 'local runner identity',
  }
}

export function SettingsView({
  workspace,
  allRepoNames,
  canEdit,
  agentOrchestratorTarget,
}: SettingsViewProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [excluded, setExcluded] = useState<Set<string>>(
    new Set(workspace.excludedRepos),
  )
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [aoSaving, setAoSaving] = useState(false)
  const [aoStatusLoading, setAoStatusLoading] = useState(false)
  const [aoStatus, setAoStatus] = useState<string | null>(null)
  const [aoError, setAoError] = useState<string | null>(null)
  const [aoEnabled, setAoEnabled] = useState(agentOrchestratorTarget?.enabled ?? false)
  const [aoConfig, setAoConfig] = useState<AgentOrchestratorConfig>(
    agentOrchestratorTarget?.config ?? defaultAoConfig(workspace),
  )

  const hasChanges =
    excluded.size !== workspace.excludedRepos.length ||
    [...excluded].some((r) => !workspace.excludedRepos.includes(r))

  async function handleSave() {
    setSaving(true)
    try {
      const saveRes = await fetch(`/api/workspaces/${workspace.id}/excluded-repos`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludedRepos: [...excluded] }),
      })
      if (saveRes.ok) {
        await fetch(`/api/sync?slug=${workspace.slug}`, { method: 'POST' })
      }
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  function toggleRepo(fullName: string) {
    if (!canEdit) return
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(fullName)) next.delete(fullName)
      else next.add(fullName)
      return next
    })
  }

  const filteredRepos = allRepoNames.filter((name) =>
    name.toLowerCase().includes(search.toLowerCase()),
  )

  function updateAoField<K extends keyof AgentOrchestratorConfig>(
    key: K,
    value: AgentOrchestratorConfig[K],
  ) {
    setAoConfig((prev) => ({ ...prev, [key]: value }))
  }

  function toggleRunner(runner: AgentRunner) {
    setAoConfig((prev) => {
      const allowed = new Set(prev.allowedRunners)
      if (allowed.has(runner)) allowed.delete(runner)
      else allowed.add(runner)
      const allowedRunners = Array.from(allowed)
      return {
        ...prev,
        allowedRunners,
        defaultRunner: allowed.has(prev.defaultRunner)
          ? prev.defaultRunner
          : (allowedRunners[0] ?? runner),
      }
    })
  }

  async function handleAoSave() {
    setAoSaving(true)
    setAoError(null)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/dispatch-targets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'agent-orchestrator',
          name: 'Agent Orchestrator',
          enabled: aoEnabled,
          config: aoConfig,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Save failed (${res.status})`)
      router.refresh()
    } catch (err) {
      setAoError(err instanceof Error ? err.message : 'Failed to save Agent Orchestrator settings')
    } finally {
      setAoSaving(false)
    }
  }

  async function checkAoStatus() {
    setAoStatusLoading(true)
    setAoError(null)
    setAoStatus(null)
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}/dispatch-targets/agent-orchestrator/status`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? `Status check failed (${res.status})`)
      setAoStatus(body.status?.message ?? 'Status check completed.')
    } catch (err) {
      setAoError(err instanceof Error ? err.message : 'Failed to check Agent Orchestrator status')
    } finally {
      setAoStatusLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Workspace Settings
      </h2>

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-semibold text-foreground">
            Details
          </h3>
          <button
            onClick={() => setEditOpen(true)}
            disabled={!canEdit}
            className="flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded-md border border-border text-foreground hover:bg-muted transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">
            <strong className="text-foreground">Name:</strong>{' '}
            {workspace.name}
          </p>
          <p className="mb-2">
            <strong className="text-foreground">Sources:</strong>
          </p>
          <div className="flex flex-col gap-1.5 ml-1">
            {workspace.sources.map((s) => (
              <div
                key={`${s.type}-${s.value}`}
                className="flex items-center gap-2 text-[12px]"
              >
                {s.type === 'org' ? (
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="text-foreground">{s.value}</span>
                <span className="text-muted-foreground/60">({s.type})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-[13px] font-semibold text-foreground">
              Agent Orchestrator
            </h3>
          </div>
          <button
            onClick={() => setAoEnabled((value) => !value)}
            disabled={!canEdit}
            className={cn(
              'h-7 px-2.5 text-[11px] font-medium rounded-md border transition-colors',
              aoEnabled
                ? 'border-[var(--health-a)]/30 bg-[var(--health-a)]/10 text-[var(--health-a)]'
                : 'border-border text-muted-foreground hover:bg-muted',
              !canEdit && 'opacity-60 cursor-not-allowed',
            )}
          >
            {aoEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <p className="text-[12px] text-muted-foreground mb-4">
          Dispatch tasks from Signals into a local or self-hosted AO process.
          AO coordinates the selected runner; Signals keeps the task, permission,
          and verification state.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-[11px] font-medium text-muted-foreground">
            AO command
            <input
              value={aoConfig.aoCommand}
              onChange={(e) => updateAoField('aoCommand', e.target.value)}
              disabled={!canEdit}
              className="h-8 px-2 text-[12px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[11px] font-medium text-muted-foreground">
            AO project ID
            <input
              value={aoConfig.projectId}
              onChange={(e) => updateAoField('projectId', e.target.value)}
              disabled={!canEdit}
              className="h-8 px-2 text-[12px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[11px] font-medium text-muted-foreground sm:col-span-2">
            AO working directory
            <input
              value={aoConfig.aoCwd}
              onChange={(e) => updateAoField('aoCwd', e.target.value)}
              placeholder="/path/to/directory/with/agent-orchestrator.yaml"
              disabled={!canEdit}
              className="h-8 px-2 text-[12px] rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[11px] font-medium text-muted-foreground">
            Dashboard URL
            <input
              value={aoConfig.dashboardUrl ?? ''}
              onChange={(e) => updateAoField('dashboardUrl', e.target.value || null)}
              disabled={!canEdit}
              className="h-8 px-2 text-[12px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[11px] font-medium text-muted-foreground">
            Runner identity
            <input
              value={aoConfig.runnerIdentity}
              onChange={(e) => updateAoField('runnerIdentity', e.target.value)}
              disabled={!canEdit}
              className="h-8 px-2 text-[12px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-medium text-muted-foreground mb-2">
            Agent runners
          </div>
          <div className="flex flex-wrap gap-2">
            {runnerOptions.map((runner) => {
              const selected = aoConfig.allowedRunners.includes(runner)
              const isDefault = aoConfig.defaultRunner === runner
              return (
                <div key={runner} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleRunner(runner)}
                    disabled={!canEdit}
                    className={cn(
                      'h-7 px-2 text-[11px] rounded-md border transition-colors',
                      selected
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted',
                      !canEdit && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    {runner}
                  </button>
                  {selected && (
                    <button
                      type="button"
                      onClick={() => updateAoField('defaultRunner', runner)}
                      disabled={!canEdit}
                      className={cn(
                        'h-7 px-2 text-[10px] rounded-md border transition-colors',
                        isDefault
                          ? 'border-[var(--health-a)]/30 bg-[var(--health-a)]/10 text-[var(--health-a)]'
                          : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {isDefault ? 'Default' : 'Set default'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border">
          <div className="min-w-0">
            {aoStatus && (
              <div className="text-[11px] text-muted-foreground truncate">
                {aoStatus}
              </div>
            )}
            {aoError && (
              <div className="text-[11px] text-[var(--health-d)] truncate">
                {aoError}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={checkAoStatus}
              disabled={aoStatusLoading}
              className="h-8 px-3 text-[12px] font-medium rounded-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <RefreshCw className={cn('w-3 h-3', aoStatusLoading && 'animate-spin')} />
              Check
            </button>
            <button
              onClick={handleAoSave}
              disabled={!canEdit || aoSaving || aoConfig.allowedRunners.length === 0}
              className="h-8 px-4 text-[12px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {aoSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold text-foreground">
            Repository Visibility
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {allRepoNames.length - excluded.size} of {allRepoNames.length} included
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground mb-3">
          Toggle repos to include or exclude them from this workspace.
          Excluded repos will not appear in dashboards or health scoring.
        </p>

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter repositories..."
            className="h-8 w-full pl-8 pr-3 text-[12px] rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto divide-y divide-border border border-border rounded-md">
          {filteredRepos.map((fullName) => {
            const isExcluded = excluded.has(fullName)
            const repoName = fullName.split('/')[1]
            return (
              <button
                key={fullName}
                onClick={() => toggleRepo(fullName)}
                disabled={!canEdit}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors',
                  isExcluded && 'opacity-50',
                  !canEdit && 'cursor-not-allowed',
                )}
              >
                {isExcluded ? (
                  <EyeOff className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-medium text-foreground">
                    {repoName}
                  </span>
                  <span className="text-[11px] text-muted-foreground ml-1.5">
                    {fullName.split('/')[0]}
                  </span>
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded',
                    isExcluded
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-[var(--health-a)]/10 text-[var(--health-a)]',
                  )}
                >
                  {isExcluded ? 'Excluded' : 'Included'}
                </span>
              </button>
            )
          })}
        </div>

        {hasChanges && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <span className="text-[12px] text-muted-foreground">
              {excluded.size} repo{excluded.size !== 1 ? 's' : ''} excluded
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setExcluded(new Set(workspace.excludedRepos))}
                disabled={!canEdit}
                className="h-8 px-3 text-[12px] font-medium rounded-md border border-border text-foreground hover:bg-muted transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !canEdit}
                className="h-8 px-4 text-[12px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save & Re-sync'}
              </button>
            </div>
          </div>
        )}
      </div>

      <WorkspaceDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        workspace={workspace}
      />
    </div>
  )
}
