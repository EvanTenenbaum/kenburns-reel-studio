import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Film, ImagePlus, Play, Sparkles, Trash2, Wand2 } from 'lucide-react';
import { deleteProject, listProjects, loadProject } from '@/store/db';
import { useProjectStore } from '@/store/projectStore';

interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail?: string;
}

export default function Home() {
  const [, navigate] = useLocation();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const { createProject, loadProject: openProject } = useProjectStore();

  async function refresh(): Promise<void> {
    setProjects(await listProjects());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function startNew(): Promise<void> {
    createProject('Instagram Reel');
    navigate('/editor');
  }

  async function open(id: string): Promise<void> {
    const project = await loadProject(id);
    if (project) {
      await openProject(project);
      navigate('/editor');
    }
  }

  async function remove(id: string): Promise<void> {
    await deleteProject(id);
    await refresh();
  }

  return (
    <main className="home-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={16} /> Mobile-first reel maker</p>
          <h1>Turn still photos into cinematic Ken Burns Reels.</h1>
          <p>
            Import images, assign pan-and-zoom motion, arrange a timeline, add music, preview in a phone-safe frame,
            and export a shareable vertical video directly in the browser.
          </p>
          <div className="hero-actions">
            <button className="primary-btn large" onClick={() => void startNew()}><ImagePlus /> Create new reel</button>
            <a className="ghost-btn large" href="https://github.com/EvanTenenbaum/kenburns-reel-studio" target="_blank" rel="noreferrer"><Film /> View repo</a>
          </div>
        </div>
        <div className="hero-preview">
          <div className="mock-phone">
            <div className="mock-photo one" />
            <div className="mock-photo two" />
            <div className="mock-caption"><Wand2 size={18} /> Pan, zoom, transition, export</div>
          </div>
        </div>
      </section>

      <section className="projects-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Local projects</p>
            <h2>Continue editing</h2>
          </div>
          <button className="primary-btn" onClick={() => void startNew()}><ImagePlus size={18} /> New project</button>
        </div>
        {projects.length === 0 ? (
          <div className="empty-projects">
            <Film size={42} />
            <h3>No saved reels yet</h3>
            <p>Your projects autosave in this browser with IndexedDB as soon as media is imported.</p>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <button className="project-thumb" onClick={() => void open(project.id)}>
                  {project.thumbnail ? <img src={project.thumbnail} alt="" /> : <Film />}
                </button>
                <div>
                  <h3>{project.name}</h3>
                  <p>Updated {new Date(project.updatedAt).toLocaleString()}</p>
                </div>
                <div className="project-actions">
                  <button className="primary-btn" onClick={() => void open(project.id)}><Play size={16} /> Open</button>
                  <button className="ghost-btn" onClick={() => void remove(project.id)}><Trash2 size={16} /> Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
