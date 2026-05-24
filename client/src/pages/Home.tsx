import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Plus, Film, Trash2, ImageOff } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProject } from '@/hooks/useProject';
import type { Project } from '@/types/project';

export default function Home() {
  const { newProject, listAllProjects, deleteProjectById } = useProject();
  const [, navigate] = useLocation();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const list = await listAllProjects();
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    setProjects(list);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const list = await listAllProjects();
      if (!active) return;
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      setProjects(list);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [listAllProjects]);

  const handleNewProject = () => {
    const created = newProject('Untitled Reel');
    navigate('/editor/' + created.id);
  };

  const handleDelete = async (
    event: React.MouseEvent,
    project: Project
  ) => {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Delete "${project.name}"? This cannot be undone.`
    );
    if (!confirmed) return;
    await deleteProjectById(project.id);
    await refresh();
    toast.success('Project deleted');
  };

  const hasProjects = projects.length > 0;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex flex-col gap-1 pt-4 pb-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Ken Burns Reel Studio
          </h1>
          <p className="text-sm text-muted-foreground">
            Turn still photos into cinematic reels.
          </p>
        </header>

        {/* Reserve space so the floating CTA never hides the last row. */}
        <section className="mt-4 pb-[max(7rem,calc(env(safe-area-inset-bottom)+6rem))]">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="aspect-[9/16] w-full rounded-2xl" />
                  <Skeleton className="h-3.5 w-3/4 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
              ))}
            </div>
          ) : !hasProjects ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 rounded-2xl border border-border bg-card/40 px-6 py-16 text-center">
              <div className="flex size-20 items-center justify-center rounded-2xl bg-muted">
                <Film className="size-9 text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <h2 className="font-display text-xl font-semibold">
                  No reels yet
                </h2>
                <p className="text-sm text-muted-foreground">
                  Create your first reel to get started.
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                onClick={handleNewProject}
                className="h-12 gap-2 px-6 transition-transform active:scale-[0.97]"
              >
                <Plus className="size-5" />
                New Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {projects.map((project, index) => {
                const cover = project.clips?.[0]?.thumbnail;
                const clipCount = project.clips?.length ?? 0;
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: Math.min(index, 8) * 0.03,
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate('/editor/' + project.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate('/editor/' + project.id);
                      }
                    }}
                    className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-transform active:scale-[0.97]"
                  >
                    <div className="relative aspect-[9/16] w-full overflow-hidden bg-muted">
                      {cover ? (
                        <img
                          src={cover}
                          alt={project.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <ImageOff className="size-8 text-muted-foreground" />
                        </div>
                      )}
                      <button
                        type="button"
                        aria-label={`Delete ${project.name}`}
                        onClick={(e) => handleDelete(e, project)}
                        className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full bg-background/70 text-foreground backdrop-blur-sm transition-transform active:scale-[0.92]"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </button>
                    </div>
                    <div className="space-y-0.5 p-3">
                      <p className="truncate text-sm font-medium">
                        {project.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {clipCount} {clipCount === 1 ? 'clip' : 'clips'}
                        {' · '}
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Thumb-reachable floating primary CTA (hidden in empty state). */}
      {hasProjects && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto w-full max-w-5xl">
            <Button
              type="button"
              size="lg"
              onClick={handleNewProject}
              className="pointer-events-auto h-14 w-full gap-2 rounded-2xl text-base shadow-lg transition-transform active:scale-[0.97]"
            >
              <Plus className="size-5" />
              New Project
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
