import Dexie, { type Table } from 'dexie';
import type { Project } from '@/types/project';

interface StoredProject {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail?: string;
  data: Project;
}

interface StoredBlob {
  id: string;
  projectId: string;
  kind: 'image' | 'audio' | 'export';
  name: string;
  type: string;
  blob: Blob;
  createdAt: number;
}

class KenBurnsDB extends Dexie {
  projects!: Table<StoredProject, string>;
  blobs!: Table<StoredBlob, string>;

  constructor() {
    super('kenburns-reel-studio');
    this.version(1).stores({
      projects: 'id, updatedAt, name',
      blobs: 'id, projectId, kind, createdAt',
    });
  }
}

export const db = new KenBurnsDB();

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put({
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    thumbnail: project.clips[0]?.thumbnail,
    data: project,
  });
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const row = await db.projects.get(id);
  return row?.data;
}

export async function listProjects(): Promise<Array<Pick<StoredProject, 'id' | 'name' | 'updatedAt' | 'thumbnail'>>> {
  const rows = await db.projects.orderBy('updatedAt').reverse().toArray();
  return rows.map(({ id, name, updatedAt, thumbnail }) => ({ id, name, updatedAt, thumbnail }));
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.blobs, async () => {
    await db.projects.delete(id);
    const blobIds = await db.blobs.where('projectId').equals(id).primaryKeys();
    await db.blobs.bulkDelete(blobIds as string[]);
  });
}

export async function saveBlob(input: Omit<StoredBlob, 'createdAt'>): Promise<string> {
  await db.blobs.put({ ...input, createdAt: Date.now() });
  return input.id;
}

export async function loadBlob(id: string): Promise<Blob | undefined> {
  return (await db.blobs.get(id))?.blob;
}

export async function materializeProject(project: Project): Promise<Project> {
  const clips = await Promise.all(project.clips.map(async (clip) => {
    if (clip.imageUrl.startsWith('blob:') || !clip.imageBlobKey) return clip;
    const blob = await loadBlob(clip.imageBlobKey);
    return blob ? { ...clip, imageUrl: URL.createObjectURL(blob) } : clip;
  }));

  const audioTracks = await Promise.all(project.audioTracks.map(async (track) => {
    if (track.url.startsWith('blob:') || !track.blobKey) return track;
    const blob = await loadBlob(track.blobKey);
    return blob ? { ...track, url: URL.createObjectURL(blob) } : track;
  }));

  return { ...project, clips, audioTracks };
}
