'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { PendingRequests } from '@/components/admin/PendingRequests';
import Link from 'next/link';

import { useApi } from '@/lib/api-client';
import { useAuth } from '@clerk/nextjs';
import { getStatusBadgeClasses } from '@/lib/badge-colors';
import { StatusTooltip } from '@/components/shared/InfoTooltip';
import { STATUS_TOOLTIPS, ADMIN_TOOLTIPS } from '@/lib/tooltip-content';
import { ShieldCheck, ShieldAlert, Trash2, RotateCcw, Upload } from 'lucide-react';

interface Publisher {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'pending_verification' | 'verified' | 'suspended';
  clerk_user_id?: string;
  website?: string;
  logo_url?: string;
  bio?: string;
  is_certified?: boolean;
  suspension_reason?: string;
  deleted_at?: string;
  deleted_by?: string;
  created_at: string;
  updated_at: string;
}

export default function AdminPublishersPage() {
  const api = useApi();
  const router = useRouter();
  const { getToken } = useAuth();
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const fetchPublishers = useCallback(async () => {
    try {
      setLoading(true);
      const url = showDeleted ? '/admin/publishers?include_deleted=true' : '/admin/publishers';
      const data = await api.admin.get<{ publishers: Publisher[] }>(url);
      setPublishers(data?.publishers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [api, showDeleted]);

  useEffect(() => {
    fetchPublishers();
  }, [fetchPublishers]);

  const handleStatusChange = async (publisherId: string, action: 'verify' | 'suspend' | 'reactivate') => {
    try {
      await api.admin.put(`/admin/publishers/${publisherId}/${action}`);

      // Refresh the list
      await fetchPublishers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleRestore = async (publisherId: string) => {
    try {
      await api.admin.put(`/admin/publishers/${publisherId}/restore`);
      await fetchPublishers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleImportPublisher = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportLoading(true);
      setImportError(null);
      setImportSuccess(null);

      const formData = new FormData();
      formData.append('file', file);

      const token = await getToken();
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

      // Use a dummy ID since we're creating new - the backend ignores it when create_new=true
      const response = await fetch(`${API_BASE}/api/v1/admin/publishers/0/import?create_new=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.error || 'Failed to import publisher');
      }

      const result = await response.json();
      setImportSuccess(result.message || 'Publisher created successfully');

      // Redirect to the new publisher page
      if (result.publisher_id) {
        setTimeout(() => {
          router.push(`/admin/publishers/${result.publisher_id}`);
        }, 1500);
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const filteredPublishers = publishers.filter((publisher) => {
    const matchesSearch =
      publisher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      publisher.email.toLowerCase().includes(searchTerm.toLowerCase());

    // Filter by deleted status when showing deleted
    if (statusFilter === 'deleted') {
      return matchesSearch && publisher.deleted_at;
    }

    // Match pending filter to both 'pending' and 'pending_verification' statuses
    const matchesStatus = statusFilter === 'all' ||
      publisher.status === statusFilter ||
      (statusFilter === 'pending' && publisher.status === 'pending_verification');

    // When showing all, include deleted if showDeleted is true
    const isDeleted = !!publisher.deleted_at;
    if (!showDeleted && isDeleted) {
      return false;
    }

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading publishers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950">
          <CardHeader>
            <CardTitle className="text-red-800 dark:text-red-200">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <Button onClick={fetchPublishers} className="mt-4" variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Publisher Management</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Manage publisher accounts and permissions</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex-1 md:flex-none">
                <Upload className="w-4 h-4 mr-2" />
                Import Publisher
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Import Publisher from Export File</DialogTitle>
                <DialogDescription>
                  Upload a complete publisher export file (.json) to create a new publisher with all their zmanim.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportPublisher}
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
                  <div className="mt-3 p-3 rounded-md bg-red-500/15 border border-red-500/40">
                    <p className="text-red-600 dark:text-red-400 text-sm font-bold">{importError}</p>
                  </div>
                )}
                {importSuccess && (
                  <p className="text-green-600 dark:text-green-400 text-sm mt-2">{importSuccess}</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportError(null); setImportSuccess(null); }}>
                  {importSuccess ? 'Close' : 'Cancel'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Link href="/admin/publishers/new" className="flex-1 md:flex-none">
            <Button className="w-full">Create New Publisher</Button>
          </Link>
        </div>
      </div>

      {/* Pending Requests */}
      <PendingRequests onApprove={fetchPublishers} />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex gap-4 items-center">
              <select
                value={statusFilter}
                onChange={(e) => {
                  const newFilter = e.target.value;
                  setStatusFilter(newFilter);
                  // Automatically enable showDeleted when "Deleted" is selected
                  if (newFilter === 'deleted') {
                    setShowDeleted(true);
                  }
                }}
                className="px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="suspended">Suspended</option>
                <option value="deleted">Deleted</option>
              </select>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="flex items-center gap-1">
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                  Show deleted
                </span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Publishers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Publishers ({filteredPublishers.length})</CardTitle>
          <CardDescription>
            {statusFilter !== 'all' ? `Showing ${statusFilter} publishers` : 'Showing all publishers'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-3 font-semibold">Publisher Name</th>
                  <th className="pb-3 font-semibold">Email</th>
                  <th className="pb-3 font-semibold">Source</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Created</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPublishers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No publishers found
                    </td>
                  </tr>
                ) : (
                  filteredPublishers.map((publisher) => {
                    const isDeleted = !!publisher.deleted_at;
                    return (
                    <tr key={publisher.id} className={`border-b hover:bg-accent/50 ${isDeleted ? 'opacity-60 bg-red-50/50 dark:bg-red-950/20' : ''}`}>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          {isDeleted && <Trash2 className="w-4 h-4 text-red-500" />}
                          <Link href={`/admin/publishers/${publisher.id}`} className={`font-medium hover:underline ${isDeleted ? 'text-muted-foreground line-through' : 'text-primary'}`}>
                            {publisher.name}
                          </Link>
                        </div>
                      </td>
                      <td className="py-4">
                        <a
                          href={`mailto:${publisher.email}`}
                          className={`hover:underline block max-w-[150px] md:max-w-[250px] truncate ${isDeleted ? 'text-muted-foreground' : 'text-primary'}`}
                          title={publisher.email}
                        >
                          {publisher.email}
                        </a>
                      </td>
                      <td className="py-4">
                        {publisher.is_certified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <ShieldCheck className="w-3 h-3" />
                            Certified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full border border-amber-200 dark:border-amber-800">
                            <ShieldAlert className="w-3 h-3" />
                            Community
                          </span>
                        )}
                      </td>
                      <td className="py-4">
                        {isDeleted ? (
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold border bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800">
                            deleted
                          </span>
                        ) : (
                          <StatusTooltip
                            status={publisher.status}
                            tooltip={
                              publisher.status === 'verified' ? STATUS_TOOLTIPS.verified :
                              publisher.status === 'pending' || publisher.status === 'pending_verification' ? STATUS_TOOLTIPS.pending_verification :
                              publisher.status === 'suspended' ? STATUS_TOOLTIPS.suspended :
                              ''
                            }
                          >
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadgeClasses(
                                publisher.status
                              )}`}
                            >
                              {publisher.status}
                            </span>
                          </StatusTooltip>
                        )}
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">
                        {isDeleted ? (
                          <span title={`Deleted on ${new Date(publisher.deleted_at!).toLocaleString()}`}>
                            {new Date(publisher.deleted_at!).toLocaleDateString()}
                          </span>
                        ) : (
                          new Date(publisher.created_at).toLocaleDateString()
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {isDeleted ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRestore(publisher.id)}
                              className="text-green-600 hover:text-green-700 border-green-300 hover:border-green-400"
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              Restore
                            </Button>
                          ) : (
                            <>
                              <Link href={`/admin/publishers/${publisher.id}`}>
                                <Button size="sm" variant="outline">
                                  View
                                </Button>
                              </Link>
                              {(publisher.status === 'pending' || publisher.status === 'pending_verification') && (
                                <StatusTooltip status="verify" tooltip={ADMIN_TOOLTIPS.verify_action}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleStatusChange(publisher.id, 'verify')}
                                  >
                                    Verify
                                  </Button>
                                </StatusTooltip>
                              )}
                              {publisher.status === 'verified' && (
                                <StatusTooltip status="suspend" tooltip={ADMIN_TOOLTIPS.suspend_action}>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleStatusChange(publisher.id, 'suspend')}
                                  >
                                    Suspend
                                  </Button>
                                </StatusTooltip>
                              )}
                              {publisher.status === 'suspended' && (
                                <StatusTooltip status="reactivate" tooltip={ADMIN_TOOLTIPS.reactivate_action}>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleStatusChange(publisher.id, 'reactivate')}
                                  >
                                    Reactivate
                                  </Button>
                                </StatusTooltip>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );})
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Note: The admin layout handles dark mode styling via className="dark"
