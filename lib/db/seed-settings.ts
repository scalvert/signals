import { getSetting, setSetting } from './queries'

export function seedDefaultSettings(): void {
  if (!getSetting('enrichment.model')) {
    setSetting('enrichment.model', 'claude-haiku-4-5-20251001')
  }
  if (!getSetting('enrichment.enabled')) {
    setSetting('enrichment.enabled', 'true')
  }
}
