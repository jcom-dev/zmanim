'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';
import { usePublisherContext } from '@/providers/PublisherContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useApi } from '@/lib/api-client';
import { UserPlus, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TeamMember {
  user_id: string;
  email: string;
  name: string;
  image_url?: string;
  added_at: string;
  is_owner: boolean;
}

export default function PublisherTeamPage() {
  const api = useApi();
  const { userId } = useAuth();
  const { selectedPublisher } = usePublisherContext();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add member dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
  }>({});

  // Email validation regex
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validate a single field
  const validateField = (field: 'name' | 'email', value: string): string | undefined => {
    switch (field) {
      case 'name':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return undefined;
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!EMAIL_REGEX.test(value)) return 'Please enter a valid email address';
        return undefined;
      default:
        return undefined;
    }
  };

  // Handle field change - clear error when user starts typing
  const handleFieldChange = (field: 'name' | 'email', value: string, setter: (v: string) => void) => {
    setter(value);
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle field blur for validation
  const handleFieldBlur = (field: 'name' | 'email', value: string) => {
    const error = validateField(field, value);
    if (error) {
      setFieldErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  const fetchTeam = useCallback(async () => {
    if (!selectedPublisher) return;

    try {
      setLoading(true);

      const data = await api.get<{ members: TeamMember[] }>('/publisher/team');
      setMembers(data.members || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [api, selectedPublisher]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    // Validate all fields
    const errors = {
      name: validateField('name', addName),
      email: validateField('email', addEmail),
    };

    // Check if there are any errors
    const hasErrors = Object.values(errors).some(e => e !== undefined);
    if (hasErrors) {
      setFieldErrors(errors);
      return;
    }

    setAddLoading(true);
    setFieldErrors({});

    try {
      const response = await api.post<{ message: string; is_new_user: boolean }>('/publisher/team/invite', {
        body: JSON.stringify({
          email: addEmail.trim().toLowerCase(),
          name: addName.trim(),
        }),
      });

      setAddEmail('');
      setAddName('');
      setAddDialogOpen(false);
      setFieldErrors({});

      // Show success message
      if (response.is_new_user) {
        setSuccessMessage(`${addName} has been added to the team. They will receive an email to set up their account.`);
      } else {
        setSuccessMessage(`${addName} has been added to the team.`);
      }
      setTimeout(() => setSuccessMessage(null), 5000);

      fetchTeam();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    try {
      await api.delete(`/publisher/team/${memberUserId}`);
      fetchTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const getInitials = (name: string, email: string) => {
    if (name) {
      const parts = name.split(' ');
      return parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : name.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  if (!selectedPublisher) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Please select a publisher to manage team members
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading team...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="text-muted-foreground mt-1">Manage who can access {selectedPublisher.name}</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Member
                </Button>
              </TooltipTrigger>
              <TooltipContent>Invite a new team member to manage this publisher</TooltipContent>
            </Tooltip>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleAddMember}>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>
                  Add a new member to your publisher team. If they don&apos;t have an account, one will be
                  created and they&apos;ll receive an email to set up their password.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={addName}
                    onChange={(e) => handleFieldChange('name', e.target.value, setAddName)}
                    onBlur={(e) => handleFieldBlur('name', e.target.value)}
                    placeholder="John Doe"
                    className={`w-full px-4 py-2 border rounded-md bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary ${
                      fieldErrors.name ? 'border-red-500 focus:ring-red-500' : 'border-border'
                    }`}
                  />
                  {fieldErrors.name && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {fieldErrors.name}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    Email Address <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={addEmail}
                    onChange={(e) => handleFieldChange('email', e.target.value, setAddEmail)}
                    onBlur={(e) => handleFieldBlur('email', e.target.value)}
                    placeholder="colleague@example.com"
                    className={`w-full px-4 py-2 border rounded-md bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary ${
                      fieldErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-border'
                    }`}
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {fieldErrors.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Error and Actions */}
              <div className="space-y-3">
                {addError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="text-sm">{addError}</span>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => {
                    setAddDialogOpen(false);
                    setFieldErrors({});
                    setAddError(null);
                  }}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addLoading || !!fieldErrors.name || !!fieldErrors.email}
                  >
                    {addLoading ? 'Adding...' : 'Add Member'}
                  </Button>
                </DialogFooter>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {successMessage && (
        <Card className="mb-6 border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950">
          <CardContent className="py-4">
            <p className="text-green-700 dark:text-green-300">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mb-6 border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950">
          <CardContent className="py-4">
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <Button onClick={() => setError(null)} className="mt-2" variant="outline" size="sm">
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Current Team ({members.length})</CardTitle>
          <CardDescription>People who can manage this publisher account</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No team members yet</p>
          ) : (
            <div className="space-y-4">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-4 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {member.image_url ? (
                      <div className="relative w-10 h-10">
                        <Image
                          src={member.image_url}
                          alt={member.name || member.email}
                          fill
                          className="rounded-full object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                        {getInitials(member.name, member.email)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.name || member.email}</span>
                        {member.is_owner && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                            Owner
                          </span>
                        )}
                      </div>
                      {member.name && (
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(member.added_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {!member.is_owner && member.user_id !== userId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                              Remove
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove this team member</TooltipContent>
                        </Tooltip>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove {member.name || member.email} from the team? They
                            will no longer be able to access this publisher account.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveMember(member.user_id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
