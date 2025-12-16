'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { usePublisherContext } from '@/providers/PublisherContext';
import { Clock, User, Code, MapPin, UserPlus, Loader2 } from 'lucide-react';
import { useApi, ApiError } from '@/lib/api-client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ActivityEntry {
  id: string;
  action_type: string;
  description: string;
  actor_id: string;
  actor_type: string;
  created_at: string;
}

export default function PublisherActivityPage() {
  const api = useApi();
  const { selectedPublisher, isLoading: contextLoading } = usePublisherContext();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    if (!selectedPublisher) return;

    try {
      setIsLoading(true);

      const data = await api.get<{ activities: ActivityEntry[] }>('/publisher/activity');
      setActivities(data.activities || []);
    } catch (err) {
      // If endpoint doesn't exist yet, show empty state
      if (err instanceof ApiError && err.isNotFound) {
        setActivities([]);
        return;
      }
      // Don't show error for now since endpoint may not exist
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, [api, selectedPublisher]);

  useEffect(() => {
    if (selectedPublisher) {
      fetchActivities();
    }
  }, [selectedPublisher, fetchActivities]);

  const getActionIcon = (actionType: string) => {
    const iconMap: Record<string, { icon: ReactNode; tooltip: string }> = {
      profile_update: { icon: <User className="w-4 h-4" />, tooltip: 'Profile update' },
      algorithm_save: { icon: <Code className="w-4 h-4" />, tooltip: 'Algorithm saved' },
      algorithm_publish: { icon: <Code className="w-4 h-4" />, tooltip: 'Algorithm published' },
      coverage_add: { icon: <MapPin className="w-4 h-4" />, tooltip: 'Coverage area added' },
      coverage_remove: { icon: <MapPin className="w-4 h-4" />, tooltip: 'Coverage area removed' },
      user_invited: { icon: <UserPlus className="w-4 h-4" />, tooltip: 'User invited' },
      user_removed: { icon: <UserPlus className="w-4 h-4" />, tooltip: 'User removed' },
    };

    const config = iconMap[actionType] || { icon: <Clock className="w-4 h-4" />, tooltip: 'Activity event' };

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div>{config.icon}</div>
        </TooltipTrigger>
        <TooltipContent>{config.tooltip}</TooltipContent>
      </Tooltip>
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  if (contextLoading || isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading activity...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <h1 className="text-3xl font-bold">Activity Log</h1>
          <p className="text-muted-foreground mt-1">
            Track changes made to your publisher account
          </p>
        </div>

        {/* Activity List */}
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-4 p-4 bg-card rounded-lg border border-border"
              >
                <div className="p-2 bg-secondary rounded-full text-muted-foreground">
                  {getActionIcon(activity.action_type)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{activity.description}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <span>{formatDate(activity.created_at)}</span>
                    {activity.actor_type === 'admin_impersonation' && (
                      <span className="px-2 py-0.5 bg-yellow-900/50 dark:bg-yellow-900/50 text-yellow-600 dark:text-yellow-400 rounded text-xs">
                        Admin (Support)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent>No activities have been logged yet</TooltipContent>
            </Tooltip>
            <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
            <p className="text-muted-foreground">
              Changes to your profile, algorithm, and coverage will be logged here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
