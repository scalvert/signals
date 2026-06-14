import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { SignalsState } from './types'

export const STATE_PATH = 'state/signals.json'

export function readState(path = STATE_PATH): SignalsState | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SignalsState
  } catch {
    return null
  }
}

export function writeState(state: SignalsState, path = STATE_PATH): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(state, null, 2) + '\n')
}
