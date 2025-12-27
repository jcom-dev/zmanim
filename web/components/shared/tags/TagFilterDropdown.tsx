'use client';

import { useState, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Tag as TagIcon, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tag, TagType, TAG_TYPE_ORDER, TAG_TYPE_LABELS, EVENT_GROUPS } from './constants';
import { useTagDisplayName } from '@/lib/hooks/usePublisherSettings';

interface TagFilterDropdownProps {
  value: string;
  onChange: (value: string) => void;
  tags: Tag[];
  placeholder?: string;
  className?: string;
}

export function TagFilterDropdown({
  value,
  onChange,
  tags,
  placeholder = 'All Tags',
  className,
}: TagFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const getTagName = useTagDisplayName();

  // Group tags by type, filtering out hidden tags
  const groupedTags = useMemo(() => {
    const groups: Record<string, Tag[]> = {};
    for (const tag of tags) {
      // Skip hidden tags (defensive - backend should already filter these)
      if (tag.is_hidden) continue;

      const type = tag.tag_type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(tag);
    }
    return groups;
  }, [tags]);

  // Filter by search
  const filteredGroups = useMemo(() => {
    if (!search) return groupedTags;
    const lower = search.toLowerCase();
    const filtered: Record<string, Tag[]> = {};
    for (const [type, typeTags] of Object.entries(groupedTags)) {
      const matches = typeTags.filter(
        (t) =>
          getTagName(t).toLowerCase().includes(lower) ||
          t.display_name_hebrew.includes(lower) ||
          t.tag_key.toLowerCase().includes(lower)
      );
      if (matches.length > 0) filtered[type] = matches;
    }
    return filtered;
  }, [groupedTags, search, getTagName]);

  // Get display label for current value
  const displayLabel = useMemo(() => {
    if (value === 'all') return placeholder;
    const tag = tags.find((t) => t.tag_key === value);
    return tag ? getTagName(tag) : value;
  }, [value, tags, placeholder, getTagName]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex items-center gap-2 justify-between min-w-[140px]',
            className
          )}
        >
          <TagIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search tags..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No tags found.</CommandEmpty>

            <CommandGroup>
              <CommandItem
                value="all"
                onSelect={() => {
                  onChange('all');
                  setOpen(false);
                  setSearch('');
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === 'all' ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {placeholder}
              </CommandItem>
            </CommandGroup>

            {TAG_TYPE_ORDER.map((type) => {
              const typeTags = filteredGroups[type];
              if (!typeTags || typeTags.length === 0) return null;

              return (
                <CommandGroup
                  key={type}
                  heading={TAG_TYPE_LABELS[type as TagType] || type}
                >
                  {typeTags.map((tag) => (
                    <CommandItem
                      key={tag.tag_key}
                      value={tag.tag_key}
                      onSelect={() => {
                        onChange(tag.tag_key);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === tag.tag_key ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="truncate">
                        {getTagName(tag)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Two-level filter variant: Type first, then Tag
interface TwoLevelTagFilterProps {
  typeValue: string;
  tagValue: string;
  onTypeChange: (value: string) => void;
  onTagChange: (value: string) => void;
  tags: Tag[];
  className?: string;
}

export function TwoLevelTagFilter({
  typeValue,
  tagValue,
  onTypeChange,
  onTagChange,
  tags,
  className,
}: TwoLevelTagFilterProps) {
  const [typeOpen, setTypeOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const getTagName = useTagDisplayName();

  // Group tags by type and count
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tag of tags) {
      counts[tag.tag_type] = (counts[tag.tag_type] || 0) + 1;
    }
    return counts;
  }, [tags]);

  // Get tags for selected type
  const filteredTags = useMemo(() => {
    if (typeValue === 'all') return tags;
    return tags.filter((t) => t.tag_type === typeValue);
  }, [tags, typeValue]);

  // Sub-group event tags (holidays, fasts, periods, etc.)
  const groupedFilteredTags = useMemo(() => {
    if (typeValue !== 'event') {
      return { ungrouped: filteredTags };
    }

    const groups: Record<string, Tag[]> = {};
    const tagsByKey = new Map(filteredTags.map((t) => [t.tag_key, t]));
    const usedKeys = new Set<string>();

    for (const [groupName, tagKeys] of Object.entries(EVENT_GROUPS)) {
      const groupTags = tagKeys
        .map((key) => tagsByKey.get(key))
        .filter((t): t is Tag => t !== undefined);
      if (groupTags.length > 0) {
        groups[groupName] = groupTags;
        tagKeys.forEach((key) => usedKeys.add(key));
      }
    }

    // Add ungrouped event tags (like shabbos, weekday, etc.)
    const ungroupedTags = filteredTags.filter((t) => !usedKeys.has(t.tag_key));
    if (ungroupedTags.length > 0) {
      groups['Other'] = ungroupedTags;
    }

    return groups;
  }, [filteredTags, typeValue]);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Type Dropdown */}
      <Popover open={typeOpen} onOpenChange={setTypeOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={typeOpen}
            className="min-w-[120px] justify-between"
          >
            <span className="truncate">
              {typeValue === 'all'
                ? 'All Types'
                : TAG_TYPE_LABELS[typeValue as TagType] || typeValue}
            </span>
            <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandList>
              <CommandItem
                value="all"
                onSelect={() => {
                  onTypeChange('all');
                  onTagChange('all');
                  setTypeOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    typeValue === 'all' ? 'opacity-100' : 'opacity-0'
                  )}
                />
                All Types
              </CommandItem>
              {TAG_TYPE_ORDER.map((type) => {
                const count = typeCounts[type] || 0;
                if (count === 0) return null;

                return (
                  <CommandItem
                    key={type}
                    value={type}
                    onSelect={() => {
                      onTypeChange(type);
                      onTagChange('all');
                      setTypeOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        typeValue === type ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {TAG_TYPE_LABELS[type as TagType]} ({count})
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Tag Dropdown */}
      <Popover open={tagOpen} onOpenChange={setTagOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={tagOpen}
            className="min-w-[140px] justify-between"
          >
            <TagIcon className="h-4 w-4 mr-2 shrink-0" />
            <span className="truncate">
              {tagValue === 'all'
                ? 'All'
                : (() => {
                    const tag = tags.find((t) => t.tag_key === tagValue);
                    return tag ? getTagName(tag) : tagValue;
                  })()}
            </span>
            <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search..." />
            <CommandList>
              <CommandEmpty>No tags found.</CommandEmpty>

              <CommandItem
                value="all"
                onSelect={() => {
                  onTagChange('all');
                  setTagOpen(false);
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    tagValue === 'all' ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {typeValue === 'all'
                  ? 'All Tags'
                  : `All ${TAG_TYPE_LABELS[typeValue as TagType] || typeValue}`}
              </CommandItem>

              {Object.entries(groupedFilteredTags).map(([groupName, groupTags]) =>
                groupName === 'ungrouped' ? (
                  groupTags.map((tag) => (
                    <CommandItem
                      key={tag.tag_key}
                      value={tag.tag_key}
                      onSelect={() => {
                        onTagChange(tag.tag_key);
                        setTagOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          tagValue === tag.tag_key
                            ? 'opacity-100'
                            : 'opacity-0'
                        )}
                      />
                      {getTagName(tag)}
                    </CommandItem>
                  ))
                ) : (
                  <CommandGroup key={groupName} heading={groupName}>
                    {groupTags.map((tag) => (
                      <CommandItem
                        key={tag.tag_key}
                        value={tag.tag_key}
                        onSelect={() => {
                          onTagChange(tag.tag_key);
                          setTagOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            tagValue === tag.tag_key
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        {getTagName(tag)}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Clear button */}
      {(typeValue !== 'all' || tagValue !== 'all') && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onTypeChange('all');
            onTagChange('all');
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          Clear
        </Button>
      )}
    </div>
  );
}
