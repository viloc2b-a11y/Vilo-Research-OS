'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

function getAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/failed to fetch|fetch failed|network/i.test(message)) {
    return 'Unable to reach the authentication service. Check your network connection or DNS settings, then try again.'
  }
  return message || 'Unable to sign in. Please try again.'
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirectedFrom') ?? '/command-center'
  const redirectedFrom = rawRedirect === '/' ? '/command-center' : rawRedirect

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(getAuthErrorMessage(signInError))
        return
      }
    } catch (signInError) {
      setError(getAuthErrorMessage(signInError))
      return
    } finally {
      setLoading(false)
    }

    const target = redirectedFrom.startsWith('/') ? redirectedFrom : '/command-center'
    router.push(target)
    router.refresh()
    // Hard navigation fallback when client router does not leave /login (headless / slow hydration).
    window.setTimeout(() => {
      if (window.location.pathname.startsWith('/login')) {
        window.location.assign(target)
      }
    }, 1500)
  }

  return (
    <Card className="w-full max-w-md border-border shadow-sm">
      <CardHeader>
        <CardTitle>Staff sign in</CardTitle>
        <CardDescription>
          Vilo OS is for authorized research site staff only. Accounts are provisioned by an
          administrator.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <a href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
