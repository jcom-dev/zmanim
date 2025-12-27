'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, AlertCircle, Building2, User } from 'lucide-react';
import Script from 'next/script';
import { cn } from '@/lib/utils';
import { LogoUploadLocal } from '@/components/publisher/LogoUploadLocal';

// reCAPTCHA site key from environment
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';

interface RegistrationFormData {
  // Step 1: Publisher info
  publisher_name: string;
  publisher_contact_email: string;
  publisher_description: string;
  publisher_logo: string | null; // Base64 data URL
  // Step 2: User info
  first_name: string;
  last_name: string;
  registrant_email: string;
}

interface FieldErrors {
  publisher_name?: string;
  publisher_contact_email?: string;
}

interface DuplicateCheckResponse {
  name_exists: boolean;
  email_exists: boolean;
  name_error?: string;
  email_error?: string;
}

export default function PublisherRegistrationPage() {
  const router = useRouter();
  const api = useApi();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState<RegistrationFormData>({
    // Step 1: Publisher info
    publisher_name: '',
    publisher_contact_email: '',
    publisher_description: '',
    publisher_logo: null,
    // Step 2: User info
    first_name: '',
    last_name: '',
    registrant_email: '',
  });

  // Logo error for display
  const [logoError, setLogoError] = useState<string | null>(null);

  // Field-level errors for duplicates
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Refs for debouncing
  const nameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const emailCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (nameCheckTimeoutRef.current) clearTimeout(nameCheckTimeoutRef.current);
      if (emailCheckTimeoutRef.current) clearTimeout(emailCheckTimeoutRef.current);
    };
  }, []);

  // Get reCAPTCHA token
  const getRecaptchaToken = useCallback(async (): Promise<string> => {
    if (!RECAPTCHA_SITE_KEY) return '';

    try {
      const grecaptcha = (window as Window & { grecaptcha?: { ready: (cb: () => void) => void; execute: (siteKey: string, options: { action: string }) => Promise<string> } }).grecaptcha;
      if (!grecaptcha) return '';

      return await new Promise((resolve) => {
        grecaptcha.ready(() => {
          grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'publisher_register' })
            .then(resolve)
            .catch(() => resolve(''));
        });
      });
    } catch {
      return '';
    }
  }, []);

  // Check for duplicate publisher name or email
  const checkDuplicate = useCallback(async (
    field: 'publisher_name' | 'publisher_contact_email',
    value: string
  ) => {
    if (!value.trim()) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
      return;
    }

    try {
      setCheckingDuplicates(true);
      const response = await api.public.post('/publishers/check-duplicate', {
        body: JSON.stringify({
          [field]: value.trim(),
        }),
      }) as DuplicateCheckResponse;

      if (field === 'publisher_name' && response.name_exists) {
        setFieldErrors((prev) => ({ ...prev, publisher_name: response.name_error || 'A publisher with this name already exists' }));
      } else if (field === 'publisher_name') {
        setFieldErrors((prev) => ({ ...prev, publisher_name: undefined }));
      }

      if (field === 'publisher_contact_email' && response.email_exists) {
        setFieldErrors((prev) => ({ ...prev, publisher_contact_email: response.email_error || 'A publisher with this contact email already exists' }));
      } else if (field === 'publisher_contact_email') {
        setFieldErrors((prev) => ({ ...prev, publisher_contact_email: undefined }));
      }
    } catch (err) {
      // Silently fail duplicate check - don't block the form
      console.error('Failed to check duplicate:', err);
    } finally {
      setCheckingDuplicates(false);
    }
  }, [api.public]);

  // Debounced handlers for blur events
  const handleNameBlur = useCallback(() => {
    if (nameCheckTimeoutRef.current) clearTimeout(nameCheckTimeoutRef.current);
    nameCheckTimeoutRef.current = setTimeout(() => {
      checkDuplicate('publisher_name', formData.publisher_name);
    }, 300);
  }, [formData.publisher_name, checkDuplicate]);

  const handleEmailBlur = useCallback(() => {
    if (emailCheckTimeoutRef.current) clearTimeout(emailCheckTimeoutRef.current);
    emailCheckTimeoutRef.current = setTimeout(() => {
      checkDuplicate('publisher_contact_email', formData.publisher_contact_email);
    }, 300);
  }, [formData.publisher_contact_email, checkDuplicate]);

  // Handle logo change from LogoUploadLocal component
  const handleLogoChange = useCallback((logoDataUrl: string | null) => {
    setFormData((prev) => ({ ...prev, publisher_logo: logoDataUrl }));
    setLogoError(null);
  }, []);

  const updateField = (field: keyof RegistrationFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);

    // Clear field error when user starts typing again
    if (field === 'publisher_name' || field === 'publisher_contact_email') {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Step 1 validates Publisher fields only
  const validateStep1 = () => {
    if (!formData.publisher_name.trim()) {
      setError('Publisher name is required');
      return false;
    }
    if (!formData.publisher_contact_email.trim()) {
      setError('Publisher contact email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.publisher_contact_email)) {
      setError('Please enter a valid contact email');
      return false;
    }
    // Block if there are duplicate errors (publisher name or contact email must be unique)
    if (fieldErrors.publisher_name) {
      setError(fieldErrors.publisher_name);
      return false;
    }
    if (fieldErrors.publisher_contact_email) {
      setError(fieldErrors.publisher_contact_email);
      return false;
    }
    return true;
  };

  // Step 2 validates User fields (first name, last name, email)
  const validateStep2 = () => {
    if (!formData.first_name.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.last_name.trim()) {
      setError('Last name is required');
      return false;
    }
    if (!formData.registrant_email.trim()) {
      setError('Your email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.registrant_email)) {
      setError('Please enter a valid email address');
      return false;
    }
    // Note: registrant_email (user email) does NOT need to be unique -
    // same user can own multiple publishers
    return true;
  };

  const handleNextStep = async () => {
    // Run duplicate checks before proceeding
    if (formData.publisher_name.trim()) {
      await checkDuplicate('publisher_name', formData.publisher_name);
    }
    if (formData.publisher_contact_email.trim()) {
      await checkDuplicate('publisher_contact_email', formData.publisher_contact_email);
    }

    // Small delay to let state update
    setTimeout(() => {
      if (step === 1 && validateStep1()) {
        setStep(2);
      }
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateStep2()) return;

    try {
      setSubmitting(true);
      setError(null);

      // Get reCAPTCHA token
      const recaptchaToken = await getRecaptchaToken();

      await api.public.post('/publishers/register', {
        body: JSON.stringify({
          first_name: formData.first_name,
          last_name: formData.last_name,
          registrant_email: formData.registrant_email,
          publisher_name: formData.publisher_name,
          publisher_contact_email: formData.publisher_contact_email,
          publisher_description: formData.publisher_description,
          publisher_logo: formData.publisher_logo,
          recaptcha_token: recaptchaToken,
        }),
      });

      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit registration';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Show success message after submission
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              <CardTitle>Check Your Email</CardTitle>
            </div>
            <CardDescription>Verification email sent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                We&apos;ve sent a verification email to <strong>{formData.registrant_email}</strong>.
                Please check your inbox and click the verification link to complete your registration.
              </AlertDescription>
            </Alert>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>Didn&apos;t receive the email?</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Check your spam folder</li>
                <li>Make sure you entered the correct email address</li>
                <li>Wait a few minutes and refresh your inbox</li>
              </ul>
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => router.push('/')}
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Register Your Publisher</CardTitle>
          <CardDescription>
            Step {step} of 2: {step === 1 ? 'Publisher Details' : 'Your Contact Info'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              // Step 1: Publisher Details Only
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="publisher_name"
                    className={cn(fieldErrors.publisher_name && "text-destructive")}
                  >
                    <Building2 className={cn("inline h-4 w-4 mr-1", fieldErrors.publisher_name && "text-destructive")} />
                    Publisher Name *
                  </Label>
                  <Input
                    id="publisher_name"
                    value={formData.publisher_name}
                    onChange={(e) => updateField('publisher_name', e.target.value)}
                    onBlur={handleNameBlur}
                    placeholder="e.g., Orthodox Union, Chabad"
                    disabled={submitting}
                    className={cn(
                      fieldErrors.publisher_name && "border-destructive focus-visible:ring-destructive"
                    )}
                    aria-invalid={!!fieldErrors.publisher_name}
                    aria-describedby={fieldErrors.publisher_name ? "publisher_name_error" : undefined}
                  />
                  {fieldErrors.publisher_name ? (
                    <p id="publisher_name_error" className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {fieldErrors.publisher_name}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      The name of your organization or rabbinic authority
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="publisher_contact_email"
                    className={cn(fieldErrors.publisher_contact_email && "text-destructive")}
                  >
                    <Mail className={cn("inline h-4 w-4 mr-1", fieldErrors.publisher_contact_email && "text-destructive")} />
                    Publisher Contact Email *
                  </Label>
                  <Input
                    id="publisher_contact_email"
                    type="email"
                    value={formData.publisher_contact_email}
                    onChange={(e) => updateField('publisher_contact_email', e.target.value)}
                    onBlur={handleEmailBlur}
                    placeholder="info@yourorganization.org"
                    disabled={submitting}
                    className={cn(
                      fieldErrors.publisher_contact_email && "border-destructive focus-visible:ring-destructive"
                    )}
                    aria-invalid={!!fieldErrors.publisher_contact_email}
                    aria-describedby={fieldErrors.publisher_contact_email ? "publisher_contact_email_error" : undefined}
                  />
                  {fieldErrors.publisher_contact_email ? (
                    <p id="publisher_contact_email_error" className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {fieldErrors.publisher_contact_email}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Public email for inquiries about your zmanim (must be unique per publisher)
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="publisher_description">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="publisher_description"
                    value={formData.publisher_description}
                    onChange={(e) => updateField('publisher_description', e.target.value)}
                    placeholder="Brief description of your organization..."
                    rows={3}
                    disabled={submitting}
                  />
                </div>

                {/* Logo Upload Section */}
                <div className="space-y-2">
                  <Label>Logo (Optional)</Label>
                  <LogoUploadLocal
                    currentLogoUrl={formData.publisher_logo}
                    publisherName={formData.publisher_name}
                    onLogoChange={handleLogoChange}
                    onError={setLogoError}
                    disabled={submitting}
                  />
                  {logoError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {logoError}
                    </p>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={handleNextStep}
                    disabled={checkingDuplicates || !!fieldErrors.publisher_name || !!fieldErrors.publisher_contact_email}
                  >
                    {checkingDuplicates ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Checking...
                      </>
                    ) : (
                      'Next: Your Info'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              // Step 2: Your Info (User details)
              <div className="space-y-4">
                <Alert>
                  <User className="h-4 w-4" />
                  <AlertDescription>
                    Your personal information for managing the publisher account.
                    You can use the same email to manage multiple publishers.
                  </AlertDescription>
                </Alert>

                {/* Name fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">
                      <User className="inline h-4 w-4 mr-1" />
                      First Name *
                    </Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => updateField('first_name', e.target.value)}
                      placeholder="John"
                      disabled={submitting}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => updateField('last_name', e.target.value)}
                      placeholder="Smith"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registrant_email">
                    <Mail className="inline h-4 w-4 mr-1" />
                    Your Email *
                  </Label>
                  <Input
                    id="registrant_email"
                    type="email"
                    value={formData.registrant_email}
                    onChange={(e) => updateField('registrant_email', e.target.value)}
                    placeholder="your.email@example.com"
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll send a verification email to this address. This email can be used across multiple publishers.
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* reCAPTCHA notice */}
                {RECAPTCHA_SITE_KEY && (
                  <p className="text-xs text-muted-foreground text-center">
                    This site is protected by reCAPTCHA and the Google{' '}
                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline">
                      Privacy Policy
                    </a>{' '}
                    and{' '}
                    <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline">
                      Terms of Service
                    </a>{' '}
                    apply.
                  </p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setStep(1);
                      setError(null);
                    }}
                    disabled={submitting}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Verification Email'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* reCAPTCHA v3 Script */}
      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
        />
      )}
    </div>
  );
}
