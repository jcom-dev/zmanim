'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePublisherContext } from '@/providers/PublisherContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogoUpload } from '@/components/publisher/LogoUpload';
import { useApi } from '@/lib/api-client';
import { usePublisherMutation } from '@/lib/hooks/useApiQuery';
import { AlertTriangle, ShieldCheck, ShieldAlert, Settings, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PublisherProfile {
  id: string;
  name: string;
  email: string;
  website?: string;
  bio?: string;
  logo_url?: string;
  logo_data?: string;
  status: string;
  is_certified?: boolean;
}

interface FieldErrors {
  name?: string;
  email?: string;
  website?: string;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// URL validation regex (optional - allows empty)
const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;

export default function PublisherProfilePage() {
  const router = useRouter();
  const api = useApi();
  const { selectedPublisher, isLoading: contextLoading, error: contextError } = usePublisherContext();
  const [profile, setProfile] = useState<PublisherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [bio, setBio] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Update profile mutation
  const updateProfileMutation = usePublisherMutation<PublisherProfile, {
    name: string;
    email: string;
    website: string | null;
    bio: string | null;
  }>(
    '/publisher/profile',
    'PUT',
    { invalidateKeys: ['publisher-profile'] }
  );

  const loadProfile = useCallback(async () => {
    if (!selectedPublisher) return;

    try {
      setLoading(true);
      setError(null);

      const profileData = await api.get<PublisherProfile>('/publisher/profile');

      setProfile(profileData);
      setName(profileData.name || '');
      setEmail(profileData.email || '');
      setWebsite(profileData.website || '');
      setBio(profileData.bio || '');
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [api, selectedPublisher]);

  useEffect(() => {
    if (selectedPublisher) {
      loadProfile();
    }
  }, [selectedPublisher, loadProfile]);

  // Add timeout for context loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (contextLoading || !selectedPublisher) {
        setLoadingTimeout(true);
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timer);
  }, [contextLoading, selectedPublisher]);

  // Validate a single field
  const validateField = (field: keyof FieldErrors, value: string): string | undefined => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return undefined;
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!EMAIL_REGEX.test(value)) return 'Please enter a valid email address';
        return undefined;
      case 'website':
        if (value.trim() && !URL_REGEX.test(value)) return 'Please enter a valid URL';
        return undefined;
      default:
        return undefined;
    }
  };

  // Handle field change with validation
  const handleFieldChange = (field: keyof FieldErrors, value: string, setter: (v: string) => void) => {
    setter(value);
    // Clear error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle field blur for validation
  const handleFieldBlur = (field: keyof FieldErrors, value: string) => {
    const error = validateField(field, value);
    if (error) {
      setFieldErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    setError(null);

    // Validate all fields
    const errors: FieldErrors = {
      name: validateField('name', name),
      email: validateField('email', email),
      website: validateField('website', website),
    };

    // Check if there are any errors
    const hasErrors = Object.values(errors).some(e => e !== undefined);
    if (hasErrors) {
      setFieldErrors(errors);
      setError('Please fix the errors below');
      return;
    }

    if (!selectedPublisher) {
      setError('No publisher selected');
      return;
    }

    setSaving(true);
    setFieldErrors({});

    updateProfileMutation.mutate(
      {
        name,
        email,
        website: website || null,
        bio: bio || null,
      },
      {
        onSuccess: (updatedProfile) => {
          setProfile(updatedProfile);
          setSuccess(true);
          setSaving(false);

          // Clear success message after 3 seconds
          setTimeout(() => setSuccess(false), 3000);
        },
        onError: (err: any) => {
          console.error('Failed to update profile:', err);
          setError(err instanceof Error ? err.message : 'Failed to update profile');
          setSaving(false);
        },
      }
    );
  };

  // Show loading only if not timed out
  if ((contextLoading || loading) && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
              <p className="mt-4 text-muted-foreground">Loading profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error if context failed, timeout occurred, or no publisher selected
  if (contextError || loadingTimeout || error || !selectedPublisher) {
    const errorMessage = contextError || error ||
      (!selectedPublisher ? 'No publisher account found. Please contact support if you believe this is an error.' : 'Request timed out. Please try again.');

    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="font-semibold text-red-800 dark:text-red-200 mb-2">Unable to Load Profile</p>
                <p className="text-red-700 dark:text-red-300 text-sm mb-4">{errorMessage}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm font-medium"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Publisher Profile</h1>
          <p className="text-muted-foreground">Manage your profile information</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your profile details. Required fields are marked with an asterisk (*).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name (Publisher/Organization Name) */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Publisher / Organization Name *
                </label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => handleFieldChange('name', e.target.value, setName)}
                  onBlur={(e) => handleFieldBlur('name', e.target.value)}
                  placeholder="Congregation Beth Israel"
                  className={fieldErrors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  required
                />
                {fieldErrors.name ? (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {fieldErrors.name}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    This will be the name displayed to users
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Contact Email *
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => handleFieldChange('email', e.target.value, setEmail)}
                  onBlur={(e) => handleFieldBlur('email', e.target.value)}
                  placeholder="contact@example.com"
                  className={fieldErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  required
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Website */}
              <div>
                <label htmlFor="website" className="block text-sm font-medium mb-2">
                  Website
                </label>
                <Input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => handleFieldChange('website', e.target.value, setWebsite)}
                  onBlur={(e) => handleFieldBlur('website', e.target.value)}
                  placeholder="https://example.com"
                  className={fieldErrors.website ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {fieldErrors.website && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {fieldErrors.website}
                  </p>
                )}
              </div>

              {/* Bio */}
              <div>
                <label htmlFor="bio" className="block text-sm font-medium mb-2">
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell users about your community and approach to zmanim..."
                  rows={4}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Logo
                </label>
                <LogoUpload
                  currentLogoUrl={profile?.logo_data || profile?.logo_url}
                  publisherName={name}
                  onUploadComplete={(logoData) => {
                    setProfile(prev => prev ? { ...prev, logo_data: logoData } : null);
                    setSuccess(true);
                    setTimeout(() => setSuccess(false), 3000);
                  }}
                  onUploadError={(errorMsg) => {
                    setError(errorMsg);
                  }}
                />
              </div>

              {/* Buttons and Messages */}
              <div className="space-y-3">
                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                {/* Success Message */}
                {success && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200">
                    <span className="text-sm">Profile updated successfully!</span>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-4">
                  <Button
                    type="submit"
                    disabled={saving || Object.values(fieldErrors).some(e => !!e)}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/publisher/dashboard')}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Related Settings */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Settings className="h-5 w-5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Additional configuration options</TooltipContent>
              </Tooltip>
              Settings
            </CardTitle>
            <CardDescription>
              Additional configuration options for your publisher account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/publisher/settings/calculation"
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent transition-colors group"
            >
              <div>
                <p className="font-medium">Pronunciation Style for Events</p>
                <p className="text-sm text-muted-foreground">
                  Choose how Hebrew events are transliterated in English
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Navigate to calculation settings</TooltipContent>
              </Tooltip>
            </Link>
          </CardContent>
        </Card>

        {/* Profile Status */}
        {profile && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Account Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Certified/Community Status - Prominent Display */}
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                profile.is_certified
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
              }`}>
                {profile.is_certified ? (
                  <>
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Verified as a certified zmanim source</TooltipContent>
                      </Tooltip>
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-800 dark:text-emerald-200">Certified Publisher</p>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300">
                        Your organization is verified as a certified source for zmanim calculations.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Community-contributed zmanim</TooltipContent>
                      </Tooltip>
                    </div>
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-200">Community Publisher</p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Your zmanim are shown as community-contributed. Contact an admin if you represent a certified organization.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Account Status */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Account Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${profile.status === 'verified' || profile.status === 'active'
                      ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300'
                      : profile.status === 'pending'
                        ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300'
                        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300'
                    }`}
                >
                  {profile.status}
                </span>
              </div>
              {profile.status === 'pending' && (
                <p className="text-sm text-muted-foreground">
                  Your profile is pending approval by an administrator.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
