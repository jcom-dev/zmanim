'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminApi } from '@/lib/api-client';
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Search,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { ZmanRegistryForm, ZmanFormData, ZmanTag } from '@/components/admin/ZmanRegistryForm';
import { ColorBadge, getTagTypeColor, getTimeCategoryColor, type ColorBadgeColor } from '@/components/ui/color-badge';
import { PreviewToolbar } from '@/components/shared/PreviewToolbar';
import { usePreviewToolbar } from '@/lib/hooks/usePreviewToolbar';

interface MasterZman {
  id: string;
  zman_key: string;
  canonical_hebrew_name: string;
  canonical_english_name: string;
  transliteration?: string;
  description?: string;
  halachic_notes?: string;
  halachic_source?: string;
  time_category: string;
  default_formula_dsl: string;
  is_core: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  tags?: (ZmanTag & { is_negated?: boolean })[];
}

interface TimeCategory {
  key: string;
  display_name: string;
}

const TIME_CATEGORIES: TimeCategory[] = [
  { key: 'dawn', display_name: 'Dawn' },
  { key: 'sunrise', display_name: 'Sunrise' },
  { key: 'morning', display_name: 'Morning' },
  { key: 'midday', display_name: 'Midday' },
  { key: 'afternoon', display_name: 'Afternoon' },
  { key: 'sunset', display_name: 'Sunset' },
  { key: 'nightfall', display_name: 'Nightfall' },
  { key: 'midnight', display_name: 'Midnight' },
];

// Color mappings are now in ColorBadge component

export default function AdminRegistryPage() {
  const api = useAdminApi();
  const [zmanim, setZmanim] = useState<MasterZman[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [showHidden, setShowHidden] = useState(true);
  const [showCoreOnly, setShowCoreOnly] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingZman, setEditingZman] = useState<MasterZman | null>(null);
  const [deletingZman, setDeletingZman] = useState<MasterZman | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Preview toolbar state
  const toolbar = usePreviewToolbar({
    storageKey: 'admin_registry',
  });

  const fetchZmanim = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('include_hidden', showHidden ? 'true' : 'false');
      if (categoryFilter !== 'all') {
        params.set('category', categoryFilter);
      }
      const data = await api.get<MasterZman[]>(`/registry/zmanim?${params}`);
      setZmanim(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch zmanim');
    } finally {
      setLoading(false);
    }
  }, [api, showHidden, categoryFilter]);

  useEffect(() => {
    fetchZmanim();
  }, [fetchZmanim]);

  const filteredZmanim = zmanim.filter((z) => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = (
        z.zman_key.toLowerCase().includes(search) ||
        z.canonical_hebrew_name.toLowerCase().includes(search) ||
        z.canonical_english_name.toLowerCase().includes(search) ||
        z.transliteration?.toLowerCase().includes(search) ||
        z.default_formula_dsl.toLowerCase().includes(search)
      );
      if (!matchesSearch) return false;
    }

    // Category filter (already applied server-side, but double-check)
    if (categoryFilter !== 'all' && z.time_category !== categoryFilter) {
      return false;
    }

    // Event filter (based on tags)
    if (eventFilter !== 'all') {
      const hasBehaviorTag = z.tags?.some(t => t.tag_type === 'behavior');
      const hasEventTag = (tagKey: string) => z.tags?.some(t => t.tag_key === tagKey || t.name === tagKey);

      if (eventFilter === 'shabbos' && !hasEventTag('shabbos')) return false;
      if (eventFilter === 'fast' && !hasEventTag('fast_day') && !hasEventTag('tisha_bav')) return false;
      if (eventFilter === 'pesach' && !hasEventTag('pesach')) return false;
      if (eventFilter === 'daily' && hasBehaviorTag) return false;
    }

    // Core filter
    if (showCoreOnly && !z.is_core) {
      return false;
    }

    return true;
  });

  const openCreateDialog = () => {
    setEditingZman(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (zman: MasterZman) => {
    setEditingZman(zman);
    setIsDialogOpen(true);
  };

  const handleSave = async (data: ZmanFormData) => {
    const payload = {
      canonical_hebrew_name: data.canonical_hebrew_name,
      canonical_english_name: data.canonical_english_name,
      transliteration: data.transliteration || null,
      description: data.description || null,
      halachic_notes: data.halachic_notes || null,
      halachic_source: data.halachic_source || null,
      time_category: data.time_category,
      default_formula_dsl: data.default_formula_dsl,
      is_core: data.is_core,
      is_hidden: data.is_hidden,
      tags: data.tags, // { tag_id, is_negated }[]
    };

    if (editingZman) {
      // Update
      await api.put(`/admin/registry/zmanim/${editingZman.id}`, {
        body: JSON.stringify(payload),
      });
    } else {
      // Create - include zman_key
      await api.post('/admin/registry/zmanim', {
        body: JSON.stringify({ ...payload, zman_key: data.zman_key }),
      });
    }
    setIsDialogOpen(false);
    fetchZmanim();
  };

  const handleDelete = async () => {
    if (!deletingZman) return;
    try {
      setIsSaving(true);
      await api.delete(`/admin/registry/zmanim/${deletingZman.id}`);
      setIsDeleteDialogOpen(false);
      setDeletingZman(null);
      fetchZmanim();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete zman');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleVisibility = async (zman: MasterZman) => {
    try {
      await api.post(`/admin/registry/zmanim/${zman.id}/toggle-visibility`, {});
      fetchZmanim();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle visibility');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Zmanim Registry</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
        <div className="flex justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Zmanim Registry</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Manage the master zmanim registry. Publishers select zmanim from this canonical list.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={openCreateDialog} className="w-full md:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Zman
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add new zman to registry</TooltipContent>
        </Tooltip>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="text-destructive">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="mt-2"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Preview Toolbar */}
      <PreviewToolbar
        storageKey="admin_registry"
        restrictToCoverage={false}
        showCoverageIndicator={false}
        showDatePicker={true}
        showLanguageToggle={true}
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 w-full">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Search zmanim, formulas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>Search zmanim by name, key, or formula</TooltipContent>
            </Tooltip>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Time:</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Times</SelectItem>
                    {TIME_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.key} value={cat.key}>
                        {cat.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Event:</Label>
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger className="w-full sm:w-[130px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="daily">Daily Only</SelectItem>
                    <SelectItem value="shabbos">Shabbos</SelectItem>
                    <SelectItem value="fast">Fast Days</SelectItem>
                    <SelectItem value="pesach">Pesach</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-core"
                  checked={showCoreOnly}
                  onCheckedChange={setShowCoreOnly}
                />
                <Label htmlFor="show-core" className="text-sm text-muted-foreground whitespace-nowrap">
                  Core
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="show-hidden"
                  checked={showHidden}
                  onCheckedChange={setShowHidden}
                />
                <Label htmlFor="show-hidden" className="text-sm text-muted-foreground whitespace-nowrap">
                  Show hidden
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{zmanim.length}</div>
            <p className="text-sm text-muted-foreground">Total Zmanim</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">
              {zmanim.filter((z) => z.is_core).length}
            </div>
            <p className="text-sm text-muted-foreground">Core</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">
              {zmanim.filter((z) => z.is_hidden).length}
            </div>
            <p className="text-sm text-muted-foreground">Hidden</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{filteredZmanim.length}</div>
            <p className="text-sm text-muted-foreground">Filtered Results</p>
          </CardContent>
        </Card>
      </div>

      {/* Zmanim Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5" />
            <div>
              <CardTitle>Master Zmanim</CardTitle>
              <CardDescription>
                {filteredZmanim.length} zmanim matching filters. Use <code className="text-xs bg-muted px-1 rounded">@zman_key</code> in DSL formulas.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr className="text-left text-sm">
                  <th className="pb-3 font-semibold text-foreground">DSL Variable</th>
                  <th className="pb-3 font-semibold text-foreground">Name</th>
                  <th className="pb-3 font-semibold text-foreground">Formula &amp; Tags</th>
                  <th className="pb-3 font-semibold text-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredZmanim.map((zman) => (
                  <tr
                    key={zman.id}
                    className={`border-b border-border hover:bg-accent/50 ${
                      zman.is_hidden ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="py-3 pr-4">
                      <code className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded text-sm font-mono font-semibold">
                        @{zman.zman_key}
                      </code>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground font-medium">{zman.canonical_english_name}</span>
                        <span className="text-foreground" dir="rtl">
                          {zman.canonical_hebrew_name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-col gap-2">
                        <code className="px-2 py-1 bg-muted text-foreground rounded text-xs font-mono inline-block w-fit">
                          {zman.default_formula_dsl}
                        </code>
                        <div className="flex flex-wrap items-center gap-1">
                          {/* Time category */}
                          <ColorBadge color={getTimeCategoryColor(zman.time_category)} size="sm">
                            {zman.time_category}
                          </ColorBadge>
                          {/* Display tags from database */}
                          {zman.tags?.slice(0, 4).map((tag) => (
                            <ColorBadge
                              key={tag.id}
                              color={getTagTypeColor(tag.tag_type)}
                              size="sm"
                              title={`${tag.tag_type}: ${tag.display_name_english}`}
                            >
                              {tag.display_name_english}
                            </ColorBadge>
                          ))}
                          {(zman.tags?.length || 0) > 4 && (
                            <ColorBadge color="slate" size="sm">
                              +{(zman.tags?.length || 0) - 4} more
                            </ColorBadge>
                          )}
                          {/* Status tags */}
                          {zman.is_core && (
                            <ColorBadge color="green" size="sm">
                              Core
                            </ColorBadge>
                          )}
                          {zman.is_hidden && (
                            <ColorBadge color="slate" size="sm">
                              Hidden
                            </ColorBadge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleVisibility(zman)}
                            >
                              {zman.is_hidden ? (
                                <Eye className="w-4 h-4" />
                              ) : (
                                <EyeOff className="w-4 h-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{zman.is_hidden ? 'Show zman' : 'Hide zman'}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(zman)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit zman</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeletingZman(zman);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete zman</TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingZman ? 'Edit Zman' : 'Create New Zman'}
            </DialogTitle>
            <DialogDescription>
              {editingZman
                ? 'Update the zman details below.'
                : 'Fill in the details to add a new zman to the registry.'}
            </DialogDescription>
          </DialogHeader>

          <ZmanRegistryForm
            mode={editingZman ? 'edit' : 'create'}
            initialData={editingZman ? {
              zman_key: editingZman.zman_key,
              canonical_hebrew_name: editingZman.canonical_hebrew_name,
              canonical_english_name: editingZman.canonical_english_name,
              transliteration: editingZman.transliteration || '',
              description: editingZman.description || '',
              halachic_notes: editingZman.halachic_notes || '',
              halachic_source: editingZman.halachic_source || '',
              time_category: editingZman.time_category,
              default_formula_dsl: editingZman.default_formula_dsl,
              is_core: editingZman.is_core,
              is_hidden: editingZman.is_hidden,
              tags: editingZman.tags?.map(t => ({ tag_id: t.id, is_negated: t.is_negated || false })) || [],
            } : undefined}
            onSave={handleSave}
            onCancel={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Delete Zman
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingZman?.canonical_english_name}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
