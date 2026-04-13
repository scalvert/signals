import type { Repo, Signal, SignalType, SignalSeverity } from '@/types/workspace'

export interface DetectedSignal {
  type: SignalType
  severity: SignalSeverity
  title: string
  body: string
  repoFullName: string
  metadata: Record<string, unknown>
}

export interface SignalDetector {
  type: SignalType
  detect(
    currentRepos: Repo[],
    previousRepos: Repo[],
    existingSignals: Signal[],
    repoContexts: Map<string, string>,
  ): DetectedSignal[]
}
