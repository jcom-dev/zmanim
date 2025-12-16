'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

export default function RegistrationSuccessPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <CardTitle>Registration Submitted!</CardTitle>
          </div>
          <CardDescription>
            Your publisher request has been submitted for review
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <p className="text-sm text-green-900">
              Thank you for registering! Our team will review your publisher request and you&apos;ll receive an email notification when it&apos;s approved.
            </p>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold">What happens next?</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Our team will review your application</li>
              <li>You&apos;ll receive an email with our decision (typically 1-3 business days)</li>
              <li>Once approved, you can sign in and start managing your publisher</li>
            </ul>
          </div>
          <Button
            className="w-full"
            onClick={() => router.push('/')}
          >
            Return to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
