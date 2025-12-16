'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAdminApi } from '@/lib/api-client';
import { CheckCircle2, XCircle, Clock, UserCheck, UserPlus, ShieldAlert, Mail, Building2, CalendarDays } from 'lucide-react';

interface Registration {
  id: string;
  first_name?: string;
  last_name?: string;
  registrant_email: string;
  publisher_name: string;
  publisher_contact_email: string;
  publisher_description: string;
  user_exists?: boolean;
  confirmed_existing_user?: boolean;
  recaptcha_score?: number;
  verified_at?: string;
  created_at: string;
  status: string;
}

interface RegistrationReviewProps {
  onApprove?: () => void;
}

export function RegistrationReview({ onApprove }: RegistrationReviewProps) {
  const api = useAdminApi();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [blockEmail, setBlockEmail] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'verified' | 'all'>('verified');

  const fetchRegistrations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Registration[]>(`/admin/publishers/registrations?status=${statusFilter}`);
      setRegistrations(data || []);
    } catch (err) {
      console.error('Error fetching registrations:', err);
    } finally {
      setLoading(false);
    }
  }, [api, statusFilter]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const handleApprove = async (registration: Registration) => {
    setActionLoading(true);
    try {
      await api.post(`/admin/publishers/registrations/${registration.id}/review`, {
        body: JSON.stringify({ action: 'approve' }),
      });
      setSelectedRegistration(null);
      fetchRegistrations();
      onApprove?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve registration');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRegistration) return;

    setActionLoading(true);
    try {
      await api.post(`/admin/publishers/registrations/${selectedRegistration.id}/review`, {
        body: JSON.stringify({
          action: 'reject',
          rejection_message: rejectReason || undefined,
          block_email: blockEmail,
        }),
      });
      setShowRejectDialog(false);
      setSelectedRegistration(null);
      setRejectReason('');
      setBlockEmail(false);
      fetchRegistrations();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject registration');
    } finally {
      setActionLoading(false);
    }
  };

  const verifiedCount = registrations.filter(r => r.status === 'verified').length;

  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Publisher Registrations
            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-sm">...</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (registrations.length === 0 && statusFilter === 'verified') {
    return null; // Hide when no pending reviews
  }

  return (
    <>
      <Card className={`mb-6 ${verifiedCount > 0 ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950' : ''}`}>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Publisher Registrations
              {verifiedCount > 0 && (
                <Badge variant="secondary" className="bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200">
                  {verifiedCount} pending
                </Badge>
              )}
            </span>
            <svg
              className={`w-5 h-5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </CardTitle>
          <CardDescription>
            {verifiedCount > 0
              ? `${verifiedCount} email-verified ${verifiedCount === 1 ? 'registration' : 'registrations'} awaiting review`
              : 'No registrations pending review'
            }
          </CardDescription>
        </CardHeader>
        {expanded && (
          <CardContent>
            {/* Status Filter */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={statusFilter === 'verified' ? 'default' : 'outline'}
                size="sm"
                onClick={(e) => { e.stopPropagation(); setStatusFilter('verified'); }}
              >
                <Clock className="h-4 w-4 mr-1" />
                Pending Review
              </Button>
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={(e) => { e.stopPropagation(); setStatusFilter('all'); }}
              >
                All
              </Button>
            </div>

            {registrations.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No registrations found</p>
            ) : (
              <div className="space-y-3">
                {registrations.map((registration) => (
                  <div
                    key={registration.id}
                    className="bg-card p-4 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedRegistration(registration)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium">{registration.publisher_name}</h4>
                          <StatusBadge status={registration.status} />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {registration.user_exists ? (
                              <UserCheck className="h-3.5 w-3.5 text-blue-500" />
                            ) : (
                              <UserPlus className="h-3.5 w-3.5 text-green-500" />
                            )}
                            {registration.first_name} {registration.last_name}
                          </span>
                          <span>{registration.registrant_email}</span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(registration.created_at).toLocaleDateString()}
                        </div>
                        {registration.recaptcha_score !== undefined && (
                          <div className={`mt-1 ${registration.recaptcha_score < 0.5 ? 'text-orange-500' : 'text-green-500'}`}>
                            Score: {registration.recaptcha_score.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Registration Details Dialog */}
      <Dialog open={!!selectedRegistration && !showRejectDialog} onOpenChange={() => setSelectedRegistration(null)}>
        <DialogContent className="max-w-lg">
          {selectedRegistration && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Publisher Registration
                </DialogTitle>
                <DialogDescription>Review the registration details</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* User Info */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedRegistration.user_exists ? (
                      <>
                        <UserCheck className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Existing User</span>
                        {selectedRegistration.confirmed_existing_user && (
                          <Badge variant="outline" className="text-xs">Confirmed</Badge>
                        )}
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">New User</span>
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>{' '}
                      {selectedRegistration.first_name} {selectedRegistration.last_name}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>{' '}
                      {selectedRegistration.registrant_email}
                    </div>
                  </div>
                </div>

                {/* Publisher Info */}
                <div>
                  <Label className="text-muted-foreground">Publisher Name</Label>
                  <p className="font-medium">{selectedRegistration.publisher_name}</p>
                </div>

                <div>
                  <Label className="text-muted-foreground">Contact Email</Label>
                  <p>{selectedRegistration.publisher_contact_email || selectedRegistration.registrant_email}</p>
                </div>

                {selectedRegistration.publisher_description && (
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="text-sm whitespace-pre-wrap">{selectedRegistration.publisher_description}</p>
                  </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                  <div>
                    <span className="text-muted-foreground">Submitted:</span>{' '}
                    {new Date(selectedRegistration.created_at).toLocaleString()}
                  </div>
                  {selectedRegistration.verified_at && (
                    <div>
                      <span className="text-muted-foreground">Verified:</span>{' '}
                      {new Date(selectedRegistration.verified_at).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* reCAPTCHA Score Warning */}
                {selectedRegistration.recaptcha_score !== undefined && selectedRegistration.recaptcha_score < 0.5 && (
                  <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertDescription>
                      Low reCAPTCHA score ({selectedRegistration.recaptcha_score.toFixed(2)}). This may indicate bot activity.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter className="gap-2">
                {selectedRegistration.status === 'verified' ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={actionLoading}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                    <Button onClick={() => handleApprove(selectedRegistration)} disabled={actionLoading}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      {actionLoading ? 'Processing...' : 'Approve'}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setSelectedRegistration(null)}>
                    Close
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Registration</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject this registration for <strong>{selectedRegistration?.publisher_name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="reason">Rejection Reason (optional)</Label>
              <textarea
                id="reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter a reason for rejection..."
                rows={3}
                className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="block-email"
                checked={blockEmail}
                onCheckedChange={(checked) => setBlockEmail(checked as boolean)}
              />
              <Label htmlFor="block-email" className="text-sm font-normal">
                Block this email from future registrations
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
              {actionLoading ? 'Rejecting...' : 'Reject Registration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'verified':
      return <Badge variant="outline" className="text-blue-600 border-blue-300">Pending Review</Badge>;
    case 'approved':
      return <Badge variant="outline" className="text-green-600 border-green-300">Approved</Badge>;
    case 'rejected':
      return <Badge variant="outline" className="text-red-600 border-red-300">Rejected</Badge>;
    case 'pending_verification':
      return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Awaiting Verification</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
