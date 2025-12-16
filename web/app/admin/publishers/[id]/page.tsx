'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Link from 'next/link';
import { useApi } from '@/lib/api-client';
import {
  Shield, ShieldAlert, ShieldCheck,
  Ban, CheckCircle2,
  Eye, Pencil, Trash2,
  RotateCcw, Mail, Globe, Calendar, Clock,
  UserPlus, Download, Upload
} from 'lucide-react';

interface Publisher {
  id: string;
  name: string;
  email?: string;
  status: string;
  website?: string;
  bio?: string;
  is_certified?: boolean;
  suspension_reason?: string;
  deleted_at?: string;
  deleted_by?: string;
  created_at: string;
  updated_at: string;
}

interface PublisherUser {
  clerk_user_id: string;
  email: string;
  name: string;
  image_url?: string;
  created_at: number;
}

export default function AdminPublisherDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const api = useApi();
  const [publisher, setPublisher] = useState<Publisher | null>(null);
  const [users, setUsers] = useState<PublisherUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    website: '',
    bio: '',
  });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [certifiedLoading, setCertifiedLoading] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [createNewPublisher, setCreateNewPublisher] = useState(false);

  const fetchPublisher = useCallback(async () => {
    try {
      // Include deleted publishers to allow viewing/restoring them
      const data = await api.admin.get<{ publishers: Publisher[] }>('/admin/publishers?include_deleted=true');
      const publishers = data?.publishers || [];
      const found = publishers.find((p: Publisher) => p.id === id);

      if (!found) {
        throw new Error('Publisher not found');
      }

      setPublisher(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [api, id]);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.admin.get<{ users: PublisherUser[] }>(`/admin/publishers/${id}/users`);
      setUsers(data?.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      // Don't set error for users - publisher may have no users yet
      setUsers([]);
    }
  }, [api, id]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPublisher(), fetchUsers()]);
      setLoading(false);
    };
    loadData();
  }, [fetchPublisher, fetchUsers]);

  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) {
      setInviteError('Email is required');
      return;
    }

    try {
      setInviteLoading(true);
      setInviteError(null);
      setInviteSuccess(null);

      const data = await api.admin.post<{ message: string }>(`/admin/publishers/${id}/users/invite`, {
        body: JSON.stringify({ email: inviteEmail }),
      });

      setInviteSuccess(data?.message || 'Invitation sent successfully');
      setInviteEmail('');
      await fetchUsers();

      // Close dialog after short delay to show success message
      setTimeout(() => {
        setInviteDialogOpen(false);
        setInviteSuccess(null);
      }, 2000);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite user');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      await api.admin.delete(`/admin/publishers/${id}/users/${userId}`);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove user');
    }
  };

  const handleStatusChange = async (action: 'verify' | 'reactivate') => {
    try {
      if (action === 'reactivate') {
        setReactivateLoading(true);
      }
      await api.admin.put(`/admin/publishers/${id}/${action}`);
      await fetchPublisher();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      if (action === 'reactivate') {
        setReactivateLoading(false);
      }
    }
  };

  const handleSuspend = async () => {
    try {
      setSuspendLoading(true);
      await api.admin.put(`/admin/publishers/${id}/suspend`, {
        body: JSON.stringify({ reason: suspendReason }),
      });
      await fetchPublisher();
      setSuspendDialogOpen(false);
      setSuspendReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSuspendLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setRestoreLoading(true);
      await api.admin.put(`/admin/publishers/${id}/restore`);
      await fetchPublisher();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleEditPublisher = async () => {
    try {
      setEditLoading(true);
      await api.admin.put(`/admin/publishers/${id}`, {
        body: JSON.stringify(editForm),
      });

      await fetchPublisher();
      setEditDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeletePublisher = async () => {
    try {
      setDeleteLoading(true);
      await api.admin.delete(`/admin/publishers/${id}`);
      router.push('/admin/publishers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setDeleteLoading(false);
    }
  };

  const handleToggleCertified = async () => {
    if (!publisher) return;
    try {
      setCertifiedLoading(true);
      await api.admin.put(`/admin/publishers/${id}/certified`, {
        body: JSON.stringify({ is_certified: !publisher.is_certified }),
      });
      await fetchPublisher();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCertifiedLoading(false);
    }
  };

  const openEditDialog = () => {
    if (publisher) {
      setEditForm({
        name: publisher.name || '',
        email: publisher.email || '',
        website: publisher.website || '',
        bio: publisher.bio || '',
      });
      setEditDialogOpen(true);
    }
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);

      const response = await api.admin.getRaw(`/admin/publishers/${id}/export`);

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `publisher-${id}.json`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Create blob and trigger download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export');
    } finally {
      setExportLoading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportLoading(true);
      setImportError(null);
      setImportSuccess(null);

      const formData = new FormData();
      formData.append('file', file);

      // Build endpoint with optional create_new query param
      const endpoint = createNewPublisher
        ? `/admin/publishers/${id}/import?create_new=true`
        : `/admin/publishers/${id}/import`;

      const result = await api.admin.post<{ message: string; publisher_created?: boolean; publisher_id?: string }>(
        endpoint,
        { body: formData }
      );

      setImportSuccess(result.message || 'Import successful');

      // If new publisher was created, redirect to the new publisher page
      if (result.publisher_created && result.publisher_id) {
        setTimeout(() => {
          router.push(`/admin/publishers/${result.publisher_id}`);
        }, 1500);
      } else {
        // Close dialog after short delay
        setTimeout(() => {
          setImportDialogOpen(false);
          setImportSuccess(null);
          setCreateNewPublisher(false);
          // Reset file input
          event.target.value = '';
        }, 2000);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading publisher details...</div>
      </div>
    );
  }

  if (error || !publisher) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-200">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 dark:text-red-300">{error || 'Publisher not found'}</p>
            <Link href="/admin/publishers">
              <Button className="mt-4" variant="outline">
                Back to Publishers
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDeleted = !!publisher.deleted_at;

  return (
    <div className="container mx-auto py-8">
      {/* Deleted Banner */}
      {isDeleted && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-red-800 dark:text-red-200">This publisher has been deleted</p>
              <p className="text-sm text-red-700 dark:text-red-300">
                Deleted on {new Date(publisher.deleted_at!).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Button
            onClick={handleRestore}
            disabled={restoreLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {restoreLoading ? 'Restoring...' : 'Restore Publisher'}
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/admin/publishers" className="text-primary hover:underline text-sm">
            Publishers
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">{publisher.name}</span>
        </div>
        <h1 className={`text-3xl font-bold ${isDeleted ? 'line-through text-muted-foreground' : ''}`}>{publisher.name}</h1>
      </div>

      {/* Unified Publisher Card */}
      <TooltipProvider delayDuration={200}>
        <Card className="mb-6 overflow-hidden">
          {/* Card Header with Status Indicators */}
          <div className="relative">
            {/* Status Bar - Visual indicator at top */}
            <div className={`h-1 ${
              publisher.status === 'suspended'
                ? 'bg-destructive'
                : publisher.status === 'pending' || publisher.status === 'pending_verification'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`} />

            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Certified/Community Badge */}
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    publisher.is_certified
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}>
                    {publisher.is_certified ? (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    ) : (
                      <ShieldAlert className="w-3.5 h-3.5" />
                    )}
                    {publisher.is_certified ? 'Certified' : 'Community'}
                  </div>

                  {/* Active/Suspended Status Badge */}
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    publisher.status === 'suspended'
                      ? 'bg-destructive/10 text-destructive'
                      : publisher.status === 'pending' || publisher.status === 'pending_verification'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  }`}>
                    {publisher.status === 'suspended' ? (
                      <Ban className="w-3.5 h-3.5" />
                    ) : publisher.status === 'pending' || publisher.status === 'pending_verification' ? (
                      <Clock className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    {publisher.status === 'suspended'
                      ? 'Suspended'
                      : publisher.status === 'pending' || publisher.status === 'pending_verification'
                        ? 'Pending'
                        : 'Active'}
                  </div>
                </div>

                {/* Context-Sensitive Action Buttons */}
                {!isDeleted && (
                  <div className="flex items-center gap-1">
                    {/* Impersonate Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          aria-label="View as publisher"
                          onClick={() => {
                            sessionStorage.setItem('impersonating', JSON.stringify({
                              publisherId: publisher.id,
                              publisher: {
                                id: publisher.id,
                                name: publisher.name,
                                status: publisher.status,
                              }
                            }));
                            router.push('/publisher/dashboard');
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View as publisher</TooltipContent>
                    </Tooltip>

                    {/* Certified Toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${
                            publisher.is_certified
                              ? 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          onClick={handleToggleCertified}
                          disabled={certifiedLoading}
                        >
                          {publisher.is_certified ? (
                            <ShieldCheck className="w-4 h-4" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {publisher.is_certified ? 'Remove certified status' : 'Mark as certified'}
                      </TooltipContent>
                    </Tooltip>

                    {/* Status Action - Context Sensitive */}
                    {publisher.status === 'suspended' ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                            onClick={() => handleStatusChange('reactivate')}
                            disabled={reactivateLoading}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reactivate publisher</TooltipContent>
                      </Tooltip>
                    ) : (publisher.status === 'pending' || publisher.status === 'pending_verification') ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                            onClick={() => handleStatusChange('verify')}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Verify publisher</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Suspend publisher</TooltipContent>
                        </Tooltip>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Suspend Publisher</DialogTitle>
                            <DialogDescription>
                              Please provide a reason for suspending &quot;{publisher.name}&quot;. This will be visible to admins.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <label className="text-sm font-medium">Reason for suspension</label>
                            <textarea
                              className="w-full px-3 py-2 mt-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary min-h-[80px]"
                              value={suspendReason}
                              onChange={(e) => setSuspendReason(e.target.value)}
                              placeholder="e.g., Violation of terms, Inaccurate data, User request..."
                              disabled={suspendLoading}
                            />
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setSuspendDialogOpen(false)} disabled={suspendLoading}>
                              Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleSuspend} disabled={suspendLoading}>
                              {suspendLoading ? 'Suspending...' : 'Suspend Publisher'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* Separator */}
                    <div className="w-px h-4 bg-border mx-1" />

                    {/* Export Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={handleExport}
                          disabled={exportLoading}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Export publisher data</TooltipContent>
                    </Tooltip>

                    {/* Import Button */}
                    <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            >
                              <Upload className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Import publisher data</TooltipContent>
                      </Tooltip>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Import Publisher Data</DialogTitle>
                          <DialogDescription>
                            Upload a JSON file to import zmanim data. This will update existing zmanim and add new ones.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="createNewPublisher"
                              checked={createNewPublisher}
                              onChange={(e) => setCreateNewPublisher(e.target.checked)}
                              disabled={importLoading}
                              className="h-4 w-4 rounded border-input"
                            />
                            <label htmlFor="createNewPublisher" className="text-sm font-medium">
                              Create as new publisher
                            </label>
                          </div>
                          {createNewPublisher && (
                            <p className="text-sm text-muted-foreground">
                              A new publisher will be created using the profile from the export file.
                            </p>
                          )}
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            disabled={importLoading}
                            className="block w-full text-sm text-muted-foreground
                              file:mr-4 file:py-2 file:px-4
                              file:rounded-md file:border-0
                              file:text-sm file:font-medium
                              file:bg-primary file:text-primary-foreground
                              hover:file:bg-primary/90
                              file:cursor-pointer cursor-pointer"
                          />
                          {importError && (
                            <p className="text-destructive text-sm mt-2">{importError}</p>
                          )}
                          {importSuccess && (
                            <p className="text-green-600 dark:text-green-400 text-sm mt-2">{importSuccess}</p>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => { setImportDialogOpen(false); setCreateNewPublisher(false); }} disabled={importLoading}>
                            Cancel
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Separator */}
                    <div className="w-px h-4 bg-border mx-1" />

                    {/* Edit Button */}
                    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={openEditDialog}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Edit details</TooltipContent>
                      </Tooltip>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Edit Publisher</DialogTitle>
                          <DialogDescription>
                            Update the publisher&apos;s information.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <label className="text-sm font-medium">Publisher / Organization Name</label>
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              placeholder="Congregation Beth Israel"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Email</label>
                            <Input
                              type="email"
                              value={editForm.email}
                              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                              placeholder="contact@example.com"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Website</label>
                            <Input
                              type="url"
                              value={editForm.website}
                              onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                              placeholder="https://example.com"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium">Bio</label>
                            <textarea
                              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary min-h-[80px]"
                              value={editForm.bio}
                              onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                              placeholder="About this publisher..."
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={editLoading}>
                            Cancel
                          </Button>
                          <Button onClick={handleEditPublisher} disabled={editLoading}>
                            {editLoading ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Delete Button */}
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Delete publisher</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Publisher</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &quot;{publisher.name}&quot;?
                            <br /><br />
                            <strong>This will:</strong>
                            <ul className="list-disc list-inside mt-2 text-sm">
                              <li>Hide the publisher from public view</li>
                              <li>Disable access for publisher users</li>
                            </ul>
                            <br />
                            <span className="text-muted-foreground">You can restore this publisher later from the deleted publishers list.</span>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeletePublisher}
                            disabled={deleteLoading}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            {deleteLoading ? 'Deleting...' : 'Delete Publisher'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>

              {/* Suspension Reason Alert */}
              {publisher.status === 'suspended' && publisher.suspension_reason && (
                <div className="mt-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-sm text-destructive">
                    <span className="font-medium">Suspension reason:</span> {publisher.suspension_reason}
                  </p>
                </div>
              )}
            </CardHeader>
          </div>

          {/* Publisher Details Grid */}
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* Email */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium uppercase tracking-wider">Email</span>
                </div>
                {publisher.email ? (
                  <a href={`mailto:${publisher.email}`} className="text-sm text-primary hover:underline block truncate">
                    {publisher.email}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>

              {/* Website */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Globe className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium uppercase tracking-wider">Website</span>
                </div>
                {publisher.website ? (
                  <a
                    href={publisher.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline block truncate"
                  >
                    {publisher.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>

              {/* Created */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium uppercase tracking-wider">Created</span>
                </div>
                <p className="text-sm">{new Date(publisher.created_at).toLocaleDateString()}</p>
              </div>

              {/* Updated */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium uppercase tracking-wider">Updated</span>
                </div>
                <p className="text-sm">{new Date(publisher.updated_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Bio - Full Width */}
            {publisher.bio && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">About</p>
                <p className="text-sm leading-relaxed">{publisher.bio}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TooltipProvider>

      {/* Users Section */}
      <TooltipProvider delayDuration={200}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Users who can manage this publisher account
            </CardDescription>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <UserPlus className="w-4 h-4" />
                    <span>Invite</span>
                  </Button>
                </DialogTrigger>
              </TooltipTrigger>
              <TooltipContent>Invite a user to manage this publisher</TooltipContent>
            </Tooltip>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite User to Publisher</DialogTitle>
                <DialogDescription>
                  Send an invitation email to allow a user to manage this publisher.
                  If the user already exists, they will be granted access immediately.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviteLoading}
                />
                {inviteError && (
                  <p className="text-destructive text-sm mt-2">{inviteError}</p>
                )}
                {inviteSuccess && (
                  <p className="text-green-600 dark:text-green-400 text-sm mt-2">{inviteSuccess}</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={inviteLoading}>
                  Cancel
                </Button>
                <Button onClick={handleInviteUser} disabled={inviteLoading}>
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No users have access to this publisher yet.</p>
              <p className="text-sm mt-2">Click &quot;Invite User&quot; to add someone.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-3 font-semibold">User</th>
                    <th className="pb-3 font-semibold">Email</th>
                    <th className="pb-3 font-semibold">Joined</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.clerk_user_id} className="border-b hover:bg-accent/50">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          {user.image_url ? (
                            <div className="relative w-8 h-8">
                              <Image
                                src={user.image_url}
                                alt={user.name}
                                fill
                                className="rounded-full object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <span className="text-muted-foreground text-sm">
                                {user.name?.charAt(0) || user.email?.charAt(0) || '?'}
                              </span>
                            </div>
                          )}
                          <span className="font-medium">{user.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <a href={`mailto:${user.email}`} className="text-primary hover:underline">
                          {user.email}
                        </a>
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove User Access</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {user.name || user.email} from this publisher?
                                They will no longer be able to manage this publisher account.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemoveUser(user.clerk_user_id)}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </TooltipProvider>
    </div>
  );
}
