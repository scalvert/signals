import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceDialog } from './WorkspaceDialog'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('./GitHubSourceSearch', () => ({
  GitHubSourceSearch: ({ onAdd }: {
    onAdd: (source: {
      type: 'user'
      value: string
      repos: { mode: 'selected'; selected: string[] }
    }) => void
  }) => (
    <button
      type="button"
      onClick={() => onAdd({
        type: 'user',
        value: 'scalvert',
        repos: {
          mode: 'selected',
          selected: ['scalvert/docusaurus-plugin-mcp-server'],
        },
      })}
    >
      Add scalvert
    </button>
  ),
}))

describe('WorkspaceDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        installations: [
          {
            id: 1,
            installationId: 135835776,
            accountLogin: 'scalvert',
            accountType: 'User',
            repositorySelection: 'selected',
            permissions: {},
            createdAt: '2026-05-26T00:00:00.000Z',
            updatedAt: '2026-05-26T00:00:00.000Z',
          },
        ],
        installUrl: 'https://github.com/apps/signals/installations/new',
      }),
    } as Response)
  })

  it('defaults the first personal workspace name so create can be submitted after adding a source', async () => {
    render(<WorkspaceDialog open onClose={vi.fn()} dismissable={false} />)

    const createButton = screen.getByRole('button', { name: 'Create Workspace' })
    expect(createButton).toBeDisabled()

    await waitFor(() => {
      expect(screen.getByDisplayValue('Personal')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Add scalvert' }))

    expect(createButton).toBeEnabled()
  })
})
