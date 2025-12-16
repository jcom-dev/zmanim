'use client';

import { useClerk } from '@clerk/nextjs';
import { useEffect } from 'react';

export default function SignOutPage() {
  const { signOut } = useClerk();

  useEffect(() => {
    signOut({ redirectUrl: '/' });
  }, [signOut]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Signing out...</p>
    </div>
  );
}
