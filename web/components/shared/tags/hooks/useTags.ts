'use client';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api-client';
import { Tag, TagType, TAG_TYPE_ORDER } from '../constants';

interface TagsResponse {
  tags: Tag[];
}

// Fetch all tags from the API
export function useTags() {
  const api = useApi();

  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await api.public.get<TagsResponse>('/registry/tags');
      return response.tags || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - tags don't change often
  });
}

// Fetch tags grouped by type
export function useTagsByType() {
  const { data: tags, ...rest } = useTags();

  const groupedTags = tags
    ? TAG_TYPE_ORDER.reduce(
        (acc, type) => {
          acc[type] = tags.filter((t) => t.tag_type === type);
          return acc;
        },
        {} as Record<TagType, Tag[]>
      )
    : ({} as Record<TagType, Tag[]>);

  return {
    ...rest,
    data: tags,
    groupedTags,
  };
}

// Fetch event tags (includes former jewish_day tags after consolidation)
export function useEventTags() {
  const { data: tags, ...rest } = useTags();

  const eventTags = tags?.filter((t) => t.tag_type === 'event') || [];

  return {
    ...rest,
    data: eventTags,
  };
}

// Alias for useEventTags - maintained for existing consumers
export const useJewishDayTags = useEventTags;
