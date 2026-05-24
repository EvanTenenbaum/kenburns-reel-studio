/**
 * IndexedDB persistence via Dexie.
 *
 * Two tables:
 *  - `projects`: serializable project metadata + structure (no runtime URLs)
 *  - `blobs`: binary image / audio data keyed by an opaque string
 *
 * Runtime-only fields (`Clip.imageUrl`, `AudioTrack.url`) are stripped before
 * writing and re-hydrated on load by the caller.
 */

import Dexie, { type Table } from 'dexie';
import type { Project } from '@/types/project';

export interface BlobRecord {
  key: string;
  blob: Blob;
}

class StudioDatabase extends Dexie {
  projects!: Table<Project, string>;
  blobs!: Table<BlobRecord, string>;

  constructor() {
    super('kenburns-reel-studio');
    this.version(1).stores({
      projects: 'id, updatedAt',
      blobs: 'key',
    });
  }
}

export const db = new StudioDatabase();

/** Remove runtime-only blob URLs so persisted data stays valid across reloads. */
function stripRuntime(project: Project): Project {
  return {
    ...project,
    clips: project.clips.map((c) => ({ ...c, imageUrl: '' })),
    audioTracks: project.audioTracks.map((a) => ({ ...a, url: '' })),
  };
}

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put(stripRuntime(project));
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function listProjects(): Promise<Project[]> {
  const all = await db.projects.toArray();
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  const project = await db.projects.get(id);
  await db.transaction('rw', db.projects, db.blobs, async () => {
    if (project) {
      const keys = [
        ...project.clips.map((c) => c.imageBlobKey),
        ...project.audioTracks.map((a) => a.blobKey),
      ].filter(Boolean);
      await Promise.all(keys.map((k) => db.blobs.delete(k)));
    }
    await db.projects.delete(id);
  });
}

export async function saveBlob(key: string, blob: Blob): Promise<void> {
  await db.blobs.put({ key, blob });
}

export async function loadBlob(key: string): Promise<Blob | undefined> {
  const record = await db.blobs.get(key);
  return record?.blob;
}

export async function deleteBlob(key: string): Promise<void> {
  await db.blobs.delete(key);
}
