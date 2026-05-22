import { redirect } from 'next/navigation'

export default async function ReposPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ repo?: string }>
}) {
  const { slug } = await params
  const { repo } = await searchParams
  const target = repo ? `/workspace/${slug}?expanded=${encodeURIComponent(repo)}` : `/workspace/${slug}`
  redirect(target)
}
