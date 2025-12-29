import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-card">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-card shadow-2xl border border-border',
            headerTitle: 'text-foreground',
            headerSubtitle: 'text-muted-foreground',
            socialButtonsBlockButton: 'bg-muted border-border text-foreground hover:bg-secondary',
            formFieldLabel: 'text-muted-foreground',
            formFieldInput: 'bg-muted border-border text-foreground',
            formButtonPrimary: 'bg-blue-600 hover:bg-blue-500',
            footerActionLink: 'text-blue-400 hover:text-blue-300',
          },
        }}
      />
    </div>
  );
}
