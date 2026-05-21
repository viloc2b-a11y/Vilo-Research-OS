import { redirect } from 'next/navigation'

/**
 * Canonical coordinator home is /command-center (sidebar "Operations").
 * Root redirects so login and bookmarks land on one action queue.
 */
export default function OpsHomePage() {
  redirect('/command-center')
}
