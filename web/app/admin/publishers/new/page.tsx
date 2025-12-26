'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApi } from '@/lib/api-client';

export default function NewPublisherPage() {
  const router = useRouter();
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    website: '',
    bio: '',
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear validation error for this field when user starts typing
    if (validationErrors[name]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    if (formData.website && !/^https?:\/\/.+/.test(formData.website)) {
      errors.website = 'Website must be a valid URL (http:// or https://)';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: {
        email: string;
        name: string;
        website?: string;
        bio?: string;
      } = {
        email: formData.email.trim(),
        name: formData.name.trim(),
      };

      if (formData.website.trim()) {
        payload.website = formData.website.trim();
      }

      if (formData.bio.trim()) {
        payload.bio = formData.bio.trim();
      }

      await api.admin.post('/admin/publishers', {
        body: JSON.stringify(payload),
      });

      // Success - redirect to publishers list
      router.push('/admin/publishers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/admin/publishers">
          <Button variant="ghost" size="sm">
            ← Back to Publishers
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create New Publisher</CardTitle>
          <CardDescription>
            Create a new publisher account. An invitation email will be sent to the provided email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-md">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 ${
                  validationErrors.email
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-border focus:ring-primary'
                }`}
                placeholder="publisher@example.com"
              />
              {validationErrors.email && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
              )}
            </div>

            {/* Name (Publisher/Organization Name) */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Publisher / Organization Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 ${
                  validationErrors.name
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-border focus:ring-primary'
                }`}
                placeholder="Congregation Beth Israel"
              />
              {validationErrors.name && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                This will be the name displayed to users
              </p>
            </div>

            {/* Website (Optional) */}
            <div>
              <label htmlFor="website" className="block text-sm font-medium mb-2">
                Website
              </label>
              <input
                type="url"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 ${
                  validationErrors.website
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-border focus:ring-primary'
                }`}
                placeholder="https://example.com"
              />
              {validationErrors.website && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.website}</p>
              )}
            </div>

            {/* Bio (Optional) */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium mb-2">
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                placeholder="Brief biography or description..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Creating...' : 'Create Publisher'}
              </Button>
              <Link href="/admin/publishers" className="flex-1">
                <Button type="button" variant="outline" className="w-full">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mt-6 p-4 bg-green-50 border border-green-300 rounded-md">
        <h3 className="font-semibold text-green-900 mb-2">What happens next?</h3>
        <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
          <li>Publisher account will be created and automatically verified</li>
          <li>Welcome email will be sent to the publisher</li>
          <li>Clerk invitation will be sent so they can sign in</li>
          <li>Publisher can immediately start configuring their algorithms</li>
        </ul>
      </div>
    </div>
  );
}
