import { SignOutButton } from '@/components/shell/sign-out-button'

type TopbarProps = {
  userEmail?: string | null
}

export function Topbar({ userEmail }: TopbarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <p className="text-sm text-muted-foreground">Clinical Research Operations</p>
      <div className="flex items-center gap-4">
        {userEmail ? (
          <span className="text-sm text-foreground">{userEmail}</span>
        ) : null}
        <SignOutButton />
      </div>
    </header>
  )
}
