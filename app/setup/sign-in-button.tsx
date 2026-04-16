'use client'

export function SignInButton() {
  return (
    <button
      onClick={() => {
        window.location.href = '/api/auth/signin'
      }}
      className="h-11 px-6 rounded-lg bg-foreground text-background text-[14px] font-semibold hover:bg-foreground/90 transition-colors"
    >
      Sign in with GitHub
    </button>
  )
}
