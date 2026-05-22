import { redirect } from 'next/navigation'

export default async function WorkPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/workspace/${slug}?filter=tasks`)
}
