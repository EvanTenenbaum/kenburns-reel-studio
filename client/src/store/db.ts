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

/**
 * True for errors that mean the on-device database was created by an older or
 * foreign schema whose object-store key paths are incompatible with this build
 * (e.g. a put failing with "key path did not yield a value"). IndexedDB cannot
 * change a store's key path in place, so the only recovery is to recreate it.
 */
function isIncompatibleSchemaError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === 'DataError' ||
    err.name === 'ConstraintError' ||
    /key path/i.test(err.message)
  );
}

let recreating: Promise<void> | null = null;

/** Drop and recreate the database with the schema this build declares. */
async function recreateDatabase(): Promise<void> {
  if (!recreating) {
    recreating = (async () => {
      try {
        db.close();
      } catch {
        /* already closed */
      }
      await db.delete();
      await db.open();
    })();
    try {
      await recreating;
    } finally {
      recreating = null;
    }
    return;
  }
  await recreating;
}

/**
 * Run a write, and if it fails because the existing database has an
 * incompatible schema, recreate the database once and retry. Reads are
 * unaffected (a wrong key path still allows reading), so only writes need this.
 */
async function withSchemaRecovery<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (!isIncompatibleSchemaError(err)) throw err;
    await recreateDatabase();
    return op();
  }
}

/** Remove runtime-only blob URLs so persisted data stays valid across reloads. */
function stripRuntime(project: Project): Project {
  return {
    ...project,
    clips: project.clips.map((c) => ({ ...c, imageUrl: '' })),
    audioTracks: project.audioTracks.map((a) => ({ ...a, url: '' })),
  };
}

/** Backfill array fields that may be missing on records written by older
 *  app versions, so the rest of the app can assume a well-formed shape. */
function normalizeLoaded(project: Project): Project {
  return {
    ...project,
    clips: Array.isArray(project.clips) ? project.clips : [],
    audioTracks: Array.isArray(project.audioTracks) ? project.audioTracks : [],
    transitions: Array.isArray(project.transitions) ? project.transitions : [],
  };
}

export async function saveProject(project: Project): Promise<void> {
  await withSchemaRecovery(() => db.projects.put(stripRuntime(project)));
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const project = await db.projects.get(id);
  return project ? normalizeLoaded(project) : undefined;
}

export async function listProjects(): Promise<Project[]> {
  const all = await db.projects.toArray();
  return all
    .map(normalizeLoaded)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  const stored = await db.projects.get(id);
  const project = stored ? normalizeLoaded(stored) : undefined;
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
  await withSchemaRecovery(() => db.blobs.put({ key, blob }));
}

export async function loadBlob(key: string): Promise<Blob | undefined> {
  const record = await db.blobs.get(key);
  return record?.blob;
}

export async function deleteBlob(key: string): Promise<void> {
  await db.blobs.delete(key);
}
