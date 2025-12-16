'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EyeOff, Power, Loader2 } from 'lucide-react';
import {
  useDisabledZmanim,
  useEnableZman,
  DisabledZman,
} from '@/lib/hooks/useZmanimList';

/**
 * DisabledZmanItem - Individual disabled zman card within the dialog
 */
function DisabledZmanItem({
  zman,
  onEnable,
  isEnabling,
}: {
  zman: DisabledZman;
  onEnable: () => void;
  isEnabling: boolean;
}) {
  const updatedDate = new Date(zman.updated_at);
  const formattedDate = updatedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="group relative p-4 rounded-lg border border-muted-foreground/20 bg-muted/30
                 hover:bg-muted/50 hover:border-muted-foreground/30
                 transition-all duration-200 ease-out overflow-hidden"
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2 overflow-hidden">
          {/* Name */}
          <div>
            <h4 className="font-semibold text-foreground leading-tight">
              {zman.hebrew_name}
            </h4>
            <p className="text-sm text-muted-foreground">
              {zman.english_name}
            </p>
          </div>

          {/* Formula - wrap with line breaks */}
          <div className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded break-all">
            {zman.formula_dsl}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <EyeOff className="h-3 w-3" />
              Last updated {formattedDate}
            </span>
            {zman.time_category && (
              <>
                <span className="text-border">•</span>
                <Badge variant="outline" className="text-xs py-0 h-5">
                  {zman.time_category}
                </Badge>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={onEnable}
            disabled={isEnabling}
            className="gap-1.5 border-green-500/30 hover:border-green-500 hover:bg-green-500/10 text-green-600 dark:text-green-400"
          >
            {isEnabling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )}
            Enable
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DisabledZmanimDialogProps {
  localityId: number | null;
}

/**
 * DisabledZmanimDialog - Main dialog for viewing and managing disabled zmanim
 */
export function DisabledZmanimDialog({ localityId }: DisabledZmanimDialogProps) {
  const [open, setOpen] = useState(false);
  const [enablingKey, setEnablingKey] = useState<string | null>(null);

  const { data: disabledZmanim = [], isLoading } = useDisabledZmanim(localityId);
  const enableZman = useEnableZman();

  const handleEnable = async (zman: DisabledZman) => {
    setEnablingKey(zman.zman_key);
    try {
      await enableZman.mutateAsync(zman.zman_key);
    } finally {
      setEnablingKey(null);
    }
  };

  const count = disabledZmanim.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 whitespace-nowrap"
        >
          <EyeOff className="h-4 w-4" />
          <span>Disabled</span>
          {count > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-5 px-1.5 min-w-5"
            >
              {count}
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-muted-foreground" />
            Disabled Zmanim
          </DialogTitle>
          <DialogDescription>
            {count === 0
              ? 'No disabled zmanim. Disabled items will appear here for re-enabling.'
              : `${count} disabled ${count === 1 ? 'zman' : 'zmanim'} available to enable.`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Loading disabled zmanim...</p>
          </div>
        ) : count === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="relative">
              <EyeOff className="h-16 w-16 text-muted-foreground/30" />
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">0</span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No disabled zmanim
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Disabled zmanim will appear here
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] -mx-6 px-6">
            <div className="space-y-3 py-1">
              {disabledZmanim.map((zman) => (
                <DisabledZmanItem
                  key={zman.id}
                  zman={zman}
                  onEnable={() => handleEnable(zman)}
                  isEnabling={enablingKey === zman.zman_key}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
