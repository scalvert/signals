'use client'

import { WorkspaceDialog } from '@/components/workspace/WorkspaceDialog'

export function CreateWorkspace() {
  return <WorkspaceDialog open onClose={() => {}} dismissable={false} />
}
