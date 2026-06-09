'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { logPasswordResetAction } from './actions'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isSessionReady, setIsSessionReady] = useState(false)

  useEffect(() => {
    // Check if we have a valid session (Supabase sets it automatically from the URL hash)
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session) {
        setIsSessionReady(true)
      } else {
        // If the URL hash was already processed or missing, auth state change might have it
        const { data: authListener } = supabase.auth.onAuthStateChange((event: string, session: any) => {
          if (session) {
            setIsSessionReady(true)
          } else {
            setError('Invalid or expired password reset link. Please request a new one.')
          }
        })
        return () => authListener.subscription.unsubscribe()
      }
    })
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })

    if (updateError) {
      setError(updateError.message)
      await logPasswordResetAction('failed', updateError.message)
      setLoading(false)
      return
    }

    await logPasswordResetAction('completed')
    setLoading(false)
    router.push('/command-center')
  }

  return (
    <div className="vilo-login-page flex min-h-screen flex-col items-center justify-center px-4">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader>
          <CardTitle>Set New Password</CardTitle>
          <CardDescription>
            Enter your new password below. It must be at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSessionReady && !error ? (
            <p className="text-sm text-muted-foreground text-center py-4">Verifying reset link...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  disabled={!isSessionReady}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  disabled={!isSessionReady}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading || !isSessionReady}>
                {loading ? 'Updating password…' : 'Update password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
