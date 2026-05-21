import Link from 'next/link'

type NoActiveOrganizationAccessProps = {
  userEmail?: string | null
}

export function NoActiveOrganizationAccess({
  userEmail,
}: NoActiveOrganizationAccessProps) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-accent p-6">
      <div className="mx-auto max-w-md vilo-card p-8 text-center">
        <h1 className="heading-serif text-xl text-foreground">
          No active organization access
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {userEmail ? (
            <>
              Signed in as <span className="font-medium text-foreground">{userEmail}</span>.
              Your site membership for this workspace is deactivated or inactive.
            </>
          ) : (
            <>Your site membership for this workspace is deactivated or inactive.</>
          )}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Historical study records and audit attribution are unchanged. Contact a site
          owner or admin to reactivate your access.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
        >
          Return to sign in
        </Link>
      </div>
    </div>
  )
}
