import { useState } from 'react';
import { CheckCircle2, Download, Loader2, RotateCcw, Share2 } from 'lucide-react';

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
        <DrawerHeader className="pt-2">
          <DrawerTitle className="font-display text-lg">Export</DrawerTitle>
          <DrawerDescription>
            Render your reel to an MP4 video.
          </DrawerDescription>
        </DrawerHeader>

        <div className="max-h-[85vh] overflow-y-auto">
          <div className="space-y-7 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="space-y-3">
              <Label className="font-display text-sm">Aspect ratio</Label>
              <div className="grid grid-cols-2 gap-2.5">
                {ASPECT_ORDER.map((ratio) => {
                  const spec = OUTPUT_SPECS[ratio];
                  const active = aspectRatio === ratio;
                  return (
                    <button
                      key={ratio}
                      type="button"
                      disabled={isExporting}
                      onClick={() => setAspectRatio(ratio)}
                      className={cn(
                        'flex min-h-[56px] flex-col items-start justify-center gap-0.5 rounded-xl border p-3 text-left transition-transform active:scale-[0.97] disabled:opacity-50',
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground'
                      )}
                    >
                      <span className="font-display text-sm">{spec.label}</span>
                      <span
                        className={cn(
                          'text-xs tabular-nums',
                          active
                            ? 'text-primary-foreground/80'
                            : 'text-muted-foreground'
                        )}
                      >
                        {ratio}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-display text-sm">Quality</Label>
              <div className="bg-muted grid grid-cols-3 gap-1 rounded-xl p-1">
                {QUALITY_OPTIONS.map((q) => {
                  const active = quality === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      disabled={isExporting}
                      onClick={() => setQuality(q)}
                      className={cn(
                        'min-h-[44px] rounded-lg text-sm font-medium capitalize transition-transform active:scale-[0.97] disabled:opacity-50',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {q}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-card border-border flex min-h-[56px] items-center justify-between rounded-xl border px-4">
              <Label htmlFor="include-audio" className="text-sm">
                Include audio
              </Label>
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
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm">
                      {STATE_LABELS[progress.state]}
                    </span>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {Math.round(progress.percent)}%
                    </span>
                  </div>
                  <Progress value={progress.percent} />
                </div>
                <p className="text-muted-foreground text-xs tabular-nums">
                  frame {progress.currentFrame} / {progress.totalFrames} · ~
                  {formatTime(progress.estimatedTimeRemaining)} left
                </p>
                <Button
                  variant="destructive"
                  className="h-12 w-full rounded-xl transition-transform active:scale-[0.97]"
                  onClick={cancel}
                >
                  Cancel
                </Button>
              </div>
            ) : isComplete ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="size-5" />
                  <p className="text-sm">Your reel is ready to download.</p>
                </div>
                <a
                  href={resultUrl}
                  download="kenburns-reel.mp4"
                  className={cn(
                    buttonVariants({ variant: 'default' }),
                    'h-12 w-full rounded-xl text-base font-medium transition-transform active:scale-[0.97]'
                  )}
                >
                  <Download className="size-5" />
                  Download MP4
                </a>
                {canShare && (
                  <Button
                    variant="secondary"
                    className="h-12 w-full rounded-xl transition-transform active:scale-[0.97]"
                    onClick={handleShare}
                  >
                    <Share2 className="size-5" />
                    Share
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-xl transition-transform active:scale-[0.97]"
                  onClick={reset}
                >
                  <RotateCcw className="size-5" />
                  Export again
                </Button>
              </div>
            ) : isError ? (
              <div className="space-y-3">
                <p className="text-destructive text-sm">
                  {progress.error ?? 'Something went wrong during export.'}
                </p>
                <Button
                  className="h-12 w-full rounded-xl transition-transform active:scale-[0.97]"
                  onClick={reset}
                >
                  <RotateCcw className="size-5" />
                  Try again
                </Button>
              </div>
            ) : (
              <Button
                className="h-14 w-full rounded-xl text-base font-medium transition-transform active:scale-[0.97]"
                disabled={!canExport}
                onClick={() => void start({ quality, includeAudio })}
              >
                {progress.state === 'preparing' ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : null}
                Export MP4
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
