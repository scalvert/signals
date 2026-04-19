import type { SignalDefinition, SignalCategory, SignalMode } from './types'

class SignalRegistry {
  private signals = new Map<string, SignalDefinition>()

  register(signal: SignalDefinition): void {
    if (this.signals.has(signal.meta.id)) {
      throw new Error(`Signal "${signal.meta.id}" is already registered`)
    }
    this.signals.set(signal.meta.id, signal)
  }

  get(id: string): SignalDefinition | undefined {
    return this.signals.get(id)
  }

  getAll(): SignalDefinition[] {
    return Array.from(this.signals.values())
  }

  getByCategory(category: SignalCategory): SignalDefinition[] {
    return this.getAll().filter((s) => s.meta.category === category)
  }

  getByMode(mode: SignalMode): SignalDefinition[] {
    return this.getAll().filter((s) => s.meta.mode === mode)
  }

  has(id: string): boolean {
    return this.signals.has(id)
  }

  get size(): number {
    return this.signals.size
  }
}

export const registry = new SignalRegistry()
