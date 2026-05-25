import { Suspense } from 'react'
import { LoginForm } from '@/components/login/login-form'

export default function LoginPage() {
  return (
    <div className="vilo-login-page flex min-h-screen flex-col items-center justify-center px-4">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
