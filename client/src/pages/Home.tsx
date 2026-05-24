import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Plus, Film, Trash2, ImageOff } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Ken Burns Reel Studio
            </h1>
            <p className="text-sm text-muted-foreground">
              Turn still photos into cinematic Instagram Reels.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            className="h-11 gap-2"
            onClick={handleNewProject}
          >
            <Plus className="size-5" />
            New Project
          </Button>
        </header>

        <section className="mt-8">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card/40 px-6 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <Film className="size-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
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
                className="h-11 gap-2"
                onClick={handleNewProject}
              >
                <Plus className="size-5" />
                New Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {projects.map((project) => {
                const cover = project.clips[0]?.thumbnail;
                return (
                  <Card
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate('/editor/' + project.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate('/editor/' + project.id);
                      }
                    }}
                    className="group cursor-pointer gap-0 overflow-hidden py-0 transition-colors hover:border-primary/60"
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
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        aria-label={`Delete ${project.name}`}
                        className="absolute right-2 top-2 size-11 opacity-90"
                        onClick={(e) => handleDelete(e, project)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <CardContent className="space-y-0.5 p-3">
                      <p className="truncate text-sm font-medium">
                        {project.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {project.clips.length}{' '}
                        {project.clips.length === 1 ? 'clip' : 'clips'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
