import { notFound } from 'next/navigation'
import { getWorkspaceBySlug } from '@/lib/db/queries'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const workspace = getWorkspaceBySlug(slug)
  if (!workspace) notFound()

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        Workspace Settings
      </h2>
      <div className="bg-card border border-border rounded-lg p-4 max-w-lg">
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">
            <strong className="text-foreground">Name:</strong>{' '}
            {workspace.name}
          </p>
          <p className="mb-2">
            <strong className="text-foreground">Sources:</strong>
          </p>
          <ul className="list-disc list-inside">
            {workspace.sources.map((s) => (
              <li key={`${s.type}-${s.value}`}>
                {s.value}{' '}
                <span className="text-muted-foreground/60">({s.type})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
