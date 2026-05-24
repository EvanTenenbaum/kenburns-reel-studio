import { useState } from 'react';
import { Download, Loader2, Share2 } from 'lucide-react';

import { useProject } from '@/hooks/useProject';
import { useExport } from '@/hooks/useExport';
import { useUIStore } from '@/store/projectStore';
import { OUTPUT_SPECS } from '@/constants/instagram';
import { formatTime } from '@/lib/math';
import { cn } from '@/lib/utils';
import type { AspectRatio } from '@/types/project';
import type { ExportProgress } from '@/types/export';
import { buttonVariants } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

type Quality = 'draft' | 'standard' | 'high';

const ASPECT_ORDER: AspectRatio[] = ['9:16', '1:1', '4:5', '16:9'];
const QUALITY_OPTIONS: Quality[] = ['draft', 'standard', 'high'];

const STATE_LABELS: Record<ExportProgress['state'], string> = {
  idle: 'Idle',
  preparing: 'Preparing',
  rendering: 'Rendering',
  encoding: 'Encoding',
  muxing: 'Finalizing',
  complete: 'Complete',
  error: 'Error',
  cancelled: 'Cancelled',
};

export function ExportSheet() {
  const openPanel = useUIStore((s) => s.openPanel);
  const closePanel = useUIStore((s) => s.closePanel);
  const { aspectRatio, setAspectRatio } = useProject();
  const { progress, resultUrl, canExport, isExporting, start, cancel, reset } =
    useExport();

  const [quality, setQuality] = useState<Quality>('standard');
  const [includeAudio, setIncludeAudio] = useState(true);

  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function';

  const handleShare = async () => {
    if (!resultUrl) return;
    try {
      const blob = await (await fetch(resultUrl)).blob();
      const file = new File([blob], 'reel.mp4', { type: 'video/mp4' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      }
    } catch {
      /* best effort: ignore share failures */
    }
  };

  const isComplete = progress.state === 'complete' && resultUrl;
  const isError = progress.state === 'error';

  return (
    <Drawer
      open={openPanel === 'export'}
      onOpenChange={(o) => {
        if (!o) closePanel();
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export</DrawerTitle>
          <DrawerDescription>
            Render your reel to an MP4 video.
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-6 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="space-y-2">
            <Label>Aspect ratio</Label>
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_ORDER.map((ratio) => {
                const spec = OUTPUT_SPECS[ratio];
                const active = aspectRatio === ratio;
                return (
                  <Button
                    key={ratio}
                    variant={active ? 'default' : 'outline'}
                    className="min-h-11 flex-col items-start gap-0 py-2"
                    disabled={isExporting}
                    onClick={() => setAspectRatio(ratio)}
                  >
                    <span className="font-medium">{spec.label}</span>
                    <span
                      className={cn(
                        'text-xs',
                        active
                          ? 'text-primary-foreground/80'
                          : 'text-muted-foreground'
                      )}
                    >
                      {ratio}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Quality</Label>
            <div className="bg-muted grid grid-cols-3 gap-1 rounded-md p-1">
              {QUALITY_OPTIONS.map((q) => (
                <Button
                  key={q}
                  variant={quality === q ? 'default' : 'ghost'}
                  className="min-h-11 capitalize"
                  disabled={isExporting}
                  onClick={() => setQuality(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="include-audio">Include audio</Label>
            <Switch
              id="include-audio"
              checked={includeAudio}
              disabled={isExporting}
              onCheckedChange={setIncludeAudio}
            />
          </div>

          {!canExport && (
            <p className="text-muted-foreground text-sm">
              Video export isn&apos;t supported in this browser.
            </p>
          )}

          {isExporting ? (
            <div className="space-y-3">
              <Progress value={progress.percent} />
              <p className="text-muted-foreground text-sm tabular-nums">
                {STATE_LABELS[progress.state]} · frame {progress.currentFrame} /{' '}
                {progress.totalFrames} · ~
                {formatTime(progress.estimatedTimeRemaining)} left
              </p>
              <Button
                variant="destructive"
                className="min-h-11 w-full"
                onClick={cancel}
              >
                Cancel
              </Button>
            </div>
          ) : isComplete ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-500">
                Your reel is ready to download.
              </p>
              <a
                href={resultUrl}
                download="kenburns-reel.mp4"
                className={cn(
                  buttonVariants({ variant: 'default' }),
                  'min-h-11 w-full'
                )}
              >
                <Download />
                Download MP4
              </a>
              {canShare && (
                <Button
                  variant="secondary"
                  className="min-h-11 w-full"
                  onClick={handleShare}
                >
                  <Share2 />
                  Share
                </Button>
              )}
              <Button
                variant="outline"
                className="min-h-11 w-full"
                onClick={reset}
              >
                Export again
              </Button>
            </div>
          ) : isError ? (
            <div className="space-y-3">
              <p className="text-destructive text-sm">
                {progress.error ?? 'Something went wrong during export.'}
              </p>
              <Button className="min-h-11 w-full" onClick={reset}>
                Try again
              </Button>
            </div>
          ) : (
            <Button
              className="min-h-11 w-full"
              disabled={!canExport}
              onClick={() => void start({ quality, includeAudio })}
            >
              {progress.state === 'preparing' ? (
                <Loader2 className="animate-spin" />
              ) : null}
              Export MP4
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
