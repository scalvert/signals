import { redirect } from 'next/navigation'

export default function Home() {
  // TODO: Check if workspaces exist in DB
  // If yes, redirect to first workspace
  // If no and DEFAULT_ORG is set, create default workspace and redirect
  // If no, redirect to /setup
  redirect('/setup')
}
