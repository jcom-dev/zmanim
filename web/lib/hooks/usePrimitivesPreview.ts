/**
 * @file usePrimitivesPreview.ts
 * @purpose Hook to manage location/date selection and preview calculation for primitives page
 * @pattern data-hook
 * @dependencies useApi, useQuery
 * @compliance useApi:✓
 */

'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/lib/api-client';

const JERUSALEM_LOCALITY_ID = 6544656; // Default to Jerusalem, Israel

interface PrimitivePreviewData {
  variable_name: string;
  time: string; // HH:mm:ss exact time
  time_rounded: string; // HH:mm:ss rounded
  time_display: string; // HH:mm display format
}

interface PrimitivesPreviewResponse {
  date: string;
  locality_id: number;
  locality_name: string;
  primitives: PrimitivePreviewData[];
}

export function usePrimitivesPreview() {
  const api = useApi();
  const [localityId, setLocalityId] = useState<number>(JERUSALEM_LOCALITY_ID);
  const [localityDisplayName, setLocalityDisplayName] = useState<string>('Jerusalem');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  });

  // Load saved locality from localStorage on mount
  useEffect(() => {
    const savedKey = 'primitives-preview-locality';
    const saved = localStorage.getItem(savedKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only use saved value if it's the new correct Jerusalem ID or a different valid ID
        // Skip the old incorrect Jerusalem ID (281184)
        if (parsed.id && parsed.displayName && parsed.id !== 281184) {
          setLocalityId(parsed.id);
          setLocalityDisplayName(parsed.displayName);
        } else if (parsed.id === 281184) {
          // Clear old invalid Jerusalem ID from localStorage
          localStorage.removeItem(savedKey);
        }
      } catch (e) {
        // Ignore parse errors, use default
      }
    }
  }, []);

  // Fetch preview data for selected locality and date
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<PrimitivesPreviewResponse>({
    queryKey: ['primitives-preview', localityId, selectedDate],
    queryFn: async () => {
      const response = await api.public.get<PrimitivesPreviewResponse>(
        `/registry/primitives/preview?locality_id=${localityId}&date=${selectedDate}`
      );
      return response;
    },
    enabled: !!localityId && !!selectedDate,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const setPreviewLocality = (id: number, displayName: string) => {
    setLocalityId(id);
    setLocalityDisplayName(displayName);
    // Save to localStorage
    const savedKey = 'primitives-preview-locality';
    localStorage.setItem(savedKey, JSON.stringify({ id, displayName }));
  };

  const setPreviewDate = (date: string) => {
    setSelectedDate(date);
  };

  // Create a map of variable_name -> preview data for easy lookup
  const previewMap = new Map<string, PrimitivePreviewData>();
  if (data?.primitives) {
    for (const p of data.primitives) {
      previewMap.set(p.variable_name, p);
    }
  }

  return {
    localityId,
    localityDisplayName,
    selectedDate,
    previewMap,
    isLoading,
    error: error instanceof Error ? error.message : null,
    setPreviewLocality,
    setPreviewDate,
    refetch,
  };
}
