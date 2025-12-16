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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApi } from '@/lib/api-client';
import {
  UserPlus,
  MoreHorizontal,
  Shield,
  Building2,
  Trash2,
  KeyRound,
  Plus,
  X,
  RefreshCw,
  Pencil,
} from 'lucide-react';

interface Publisher {
  id: string;
  name: string;
}

interface UserWithRoles {
  clerk_user_id: string;
  email: string;
  name: string;
  is_admin: boolean;
  publisher_access_list: string[];
  publishers: Publisher[];
  created_at: string;
}

interface AddUserFormData {
  email: string;
  name: string;
  isAdmin: boolean;
  publisherIds: string[];
}

export default function AdminUsersPage() {
  const api = useApi();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [allPublishers, setAllPublishers] = useState<Publisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Dialog states
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [addPublisherDialogOpen, setAddPublisherDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit user form state
  const [editUserName, setEditUserName] = useState('');

  // Form state for adding user
  const [addUserForm, setAddUserForm] = useState<AddUserFormData>({
    email: '',
    name: '',
    isAdmin: false,
    publisherIds: [],
  });

  // For adding publisher to existing user
  const [selectedPublisherId, setSelectedPublisherId] = useState<string>('');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      const data = await api.admin.get<{ users: UserWithRoles[] }>('/admin/users');
      setUsers(data?.users || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchPublishers = useCallback(async () => {
    try {
      const data = await api.admin.get<{ publishers: Publisher[] }>('/admin/publishers');
      setAllPublishers(data?.publishers || []);
    } catch (err) {
      console.error('Failed to fetch publishers:', err);
    }
  }, [api]);

  useEffect(() => {
    fetchUsers();
    fetchPublishers();
  }, [fetchUsers, fetchPublishers]);

  const handleAddUser = async () => {
    try {
      setActionLoading(true);

      await api.admin.post('/admin/users', {
        body: JSON.stringify({
          email: addUserForm.email,
          name: addUserForm.name,
          is_admin: addUserForm.isAdmin,
          publisher_ids: addUserForm.publisherIds,
        }),
      });

      setAddUserDialogOpen(false);
      setAddUserForm({ email: '', name: '', isAdmin: false, publisherIds: [] });
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditUserDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setEditUserName(user.name || '');
    setEditUserDialogOpen(true);
  };

  const handleEditUser = async () => {
    if (!selectedUser || !editUserName.trim()) return;

    try {
      setActionLoading(true);

      await api.admin.put(`/admin/users/${selectedUser.clerk_user_id}`, {
        body: JSON.stringify({ name: editUserName.trim() }),
      });

      setEditUserDialogOpen(false);
      setSelectedUser(null);
      setEditUserName('');
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAdmin = async (user: UserWithRoles) => {
    try {
      setActionLoading(true);

      await api.admin.put(`/admin/users/${user.clerk_user_id}/admin`, {
        body: JSON.stringify({ is_admin: !user.is_admin }),
      });

      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async (user: UserWithRoles) => {
    try {
      setActionLoading(true);

      await api.admin.post(`/admin/users/${user.clerk_user_id}/reset-password`);

      alert(`Password reset email sent to ${user.email}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    const userToDelete = selectedUser;

    try {
      setActionLoading(true);

      await api.admin.delete(`/admin/users/${userToDelete.clerk_user_id}`);

      // Optimistic update: remove user from local state immediately
      setUsers((prevUsers) => prevUsers.filter((u) => u.clerk_user_id !== userToDelete.clerk_user_id));
      setDeleteConfirmOpen(false);
      setSelectedUser(null);

      // Also refresh from server to ensure consistency
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      // If error, refresh to get accurate state
      fetchUsers();
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddPublisherToUser = async () => {
    if (!selectedUser || !selectedPublisherId) return;

    try {
      setActionLoading(true);

      await api.admin.post(`/admin/users/${selectedUser.clerk_user_id}/publishers`, {
        body: JSON.stringify({ publisher_id: selectedPublisherId }),
      });

      setAddPublisherDialogOpen(false);
      setSelectedPublisherId('');
      setSelectedUser(null);
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePublisherFromUser = async (user: UserWithRoles, publisherId: string) => {
    try {
      setActionLoading(true);

      await api.admin.delete(`/admin/users/${user.clerk_user_id}/publishers/${publisherId}`);

      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      (user.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());

    const publisherCount = user.publisher_access_list?.length ?? 0;
    let matchesRole = true;
    if (roleFilter === 'admin') {
      matchesRole = user.is_admin;
    } else if (roleFilter === 'publisher') {
      matchesRole = publisherCount > 0 && !user.is_admin;
    } else if (roleFilter === 'dual') {
      matchesRole = user.is_admin && publisherCount > 0;
    }

    return matchesSearch && matchesRole;
  });

  // Get publishers that a user doesn't already have access to
  const getAvailablePublishers = (user: UserWithRoles) => {
    const accessList = user.publisher_access_list || [];
    return allPublishers.filter((p) => !accessList.includes(p.id));
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{error}</p>
            <Button
              onClick={() => {
                setError(null);
                fetchUsers();
              }}
              className="mt-4"
              variant="outline"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage admin and publisher access for all users
          </p>
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={fetchUsers}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh user list</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => setAddUserDialogOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add new user or update roles</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin Only</SelectItem>
                  <SelectItem value="publisher">Publisher Only</SelectItem>
                  <SelectItem value="dual">Both Roles</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
          <CardDescription>
            Users with admin access or publisher team membership
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-3 font-semibold">Name</th>
                  <th className="pb-3 font-semibold">Email</th>
                  <th className="pb-3 font-semibold">Roles</th>
                  <th className="pb-3 font-semibold">Publishers</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.clerk_user_id} className="border-b hover:bg-accent/50">
                      <td className="py-4 font-medium">{user.name}</td>
                      <td className="py-4">
                        <a
                          href={`mailto:${user.email}`}
                          className="text-primary hover:underline"
                        >
                          {user.email}
                        </a>
                      </td>
                      <td className="py-4">
                        <div className="flex gap-2">
                          {user.is_admin && (
                            <Badge variant="default" className="bg-purple-600">
                              <Shield className="w-3 h-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {(user.publisher_access_list?.length ?? 0) > 0 && (
                            <Badge variant="secondary">
                              <Building2 className="w-3 h-3 mr-1" />
                              Publisher
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex flex-wrap gap-1">
                          {(user.publishers?.length ?? 0) === 0 ? (
                            <span className="text-muted-foreground text-sm">None</span>
                          ) : (
                            user.publishers?.map((pub) => (
                              <Badge
                                key={pub.id}
                                variant="outline"
                                className="flex items-center gap-1"
                              >
                                {pub.name}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleRemovePublisherFromUser(user, pub.id)}
                                      className="ml-1 hover:text-destructive"
                                      disabled={actionLoading}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>Remove publisher access</TooltipContent>
                                </Tooltip>
                              </Badge>
                            ))
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setAddPublisherDialogOpen(true);
                                }}
                                disabled={getAvailablePublishers(user).length === 0}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Add publisher access</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                      <td className="py-4 text-right">
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>User actions</TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditUserDialog(user)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleAdmin(user)}>
                              <Shield className="w-4 h-4 mr-2" />
                              {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setAddPublisherDialogOpen(true);
                              }}
                              disabled={getAvailablePublishers(user).length === 0}
                            >
                              <Building2 className="w-4 h-4 mr-2" />
                              Add Publisher Access
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                              <KeyRound className="w-4 h-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setSelectedUser(user);
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Add a new user or update an existing user&apos;s roles. If the user already exists,
              their roles will be updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={addUserForm.email}
                onChange={(e) => setAddUserForm({ ...addUserForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={addUserForm.name}
                onChange={(e) => setAddUserForm({ ...addUserForm, name: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isAdmin"
                checked={addUserForm.isAdmin}
                onCheckedChange={(checked) =>
                  setAddUserForm({ ...addUserForm, isAdmin: checked === true })
                }
              />
              <Label htmlFor="isAdmin">Grant admin access</Label>
            </div>
            <div className="space-y-2">
              <Label>Publisher Access</Label>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                {allPublishers.map((pub) => (
                  <div key={pub.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`pub-${pub.id}`}
                      checked={addUserForm.publisherIds.includes(pub.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setAddUserForm({
                            ...addUserForm,
                            publisherIds: [...addUserForm.publisherIds, pub.id],
                          });
                        } else {
                          setAddUserForm({
                            ...addUserForm,
                            publisherIds: addUserForm.publisherIds.filter((id) => id !== pub.id),
                          });
                        }
                      }}
                    />
                    <Label htmlFor={`pub-${pub.id}`} className="font-normal">
                      {pub.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={!addUserForm.email || !addUserForm.name || actionLoading}
            >
              {actionLoading ? 'Adding...' : 'Add User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the user&apos;s information.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={selectedUser?.email || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                placeholder="John Doe"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditUser}
              disabled={!editUserName.trim() || actionLoading}
            >
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Publisher to User Dialog */}
      <Dialog open={addPublisherDialogOpen} onOpenChange={setAddPublisherDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Publisher Access</DialogTitle>
            <DialogDescription>
              Grant {selectedUser?.name} access to a publisher team.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="publisher">Select Publisher</Label>
            <Select value={selectedPublisherId} onValueChange={setSelectedPublisherId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a publisher..." />
              </SelectTrigger>
              <SelectContent>
                {selectedUser &&
                  getAvailablePublishers(selectedUser).map((pub) => (
                    <SelectItem key={pub.id} value={pub.id}>
                      {pub.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPublisherDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddPublisherToUser}
              disabled={!selectedPublisherId || actionLoading}
            >
              {actionLoading ? 'Adding...' : 'Add Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.name}? This will remove all their
              roles and delete their account permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={actionLoading}>
              {actionLoading ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
