import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import {
  Download,
  FileVideo,
  ImagePlus,
  Music,
  Pause,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Save,
  Scissors,
  Sparkles,
  Trash2,
  UploadCloud,
  Wand2,
} from 'lucide-react';
import { computeViewportAtTime, viewportToSourceRect } from '@/engine/kenburns';
import { formatTime } from '@/lib/math';
import { MAX_CLIP_DURATION_MS, MIN_CLIP_DURATION_MS, MAX_TRANSITION_DURATION_MS, MIN_TRANSITION_DURATION_MS } from '@/constants/instagram';
import { MOTION_PRESETS } from '@/constants/presets';
import type { AudioTrack } from '@/types/audio';
import type { Clip, TransitionType } from '@/types/project';
import { totalDuration, useProjectStore } from '@/store/projectStore';

type LoadedImage = HTMLImageElement & { decode(): Promise<void> };

const transitionTypes: TransitionType[] = [
  'crossfade',
  'fade-through-black',
  'fade-through-white',
  'slide-left',
  'slide-right',
  'zoom-through',
  'blur-transition',
  'cut',
];

function label(value: string): string {
  return value.split('-').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}

function currentClip(clips: Clip[], playhead: number): Clip | undefined {
  return clips.find((clip) => playhead >= clip.startTime && playhead <= clip.startTime + clip.duration) ?? clips[0];
}

function progressForClip(clip: Clip | undefined, playhead: number): number {
  if (!clip) return 0;
  return Math.max(0, Math.min(1, (playhead - clip.startTime) / clip.duration));
}

async function imageElement(src: string): Promise<LoadedImage> {
  const image = new Image() as LoadedImage;
  image.crossOrigin = 'anonymous';
  image.src = src;
  await image.decode();
  return image;
}

async function exportTimeline(clips: Clip[], duration: number, onProgress: (percent: number) => void): Promise<Blob> {
  if (clips.length === 0) throw new Error('Add images before exporting.');
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is not supported in this browser.');

  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const images = new Map<string, LoadedImage>();
  await Promise.all(clips.map(async (clip) => images.set(clip.id, await imageElement(clip.imageUrl))));

  const fps = 30;
  const totalFrames = Math.max(1, Math.ceil((duration / 1000) * fps));
  let frame = 0;

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Video recorder failed.'));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start(500);

  await new Promise<void>((resolve) => {
    const draw = () => {
      const time = (frame / fps) * 1000;
      const clip = currentClip(clips, time) ?? clips[clips.length - 1];
      const image = images.get(clip.id);
      ctx.fillStyle = '#050816';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (image) {
        const viewport = computeViewportAtTime(clip.kenburns, time - clip.startTime, clip.duration);
        const source = viewportToSourceRect(viewport, image.naturalWidth, image.naturalHeight, canvas.width, canvas.height);
        ctx.drawImage(image, source.sx, source.sy, source.sw, source.sh, 0, 0, canvas.width, canvas.height);
      }
      ctx.fillStyle = 'rgba(0,0,0,.26)';
      ctx.fillRect(0, canvas.height - 150, canvas.width, 150);
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.font = '600 42px Inter, system-ui, sans-serif';
      ctx.fillText('Ken Burns Reel Studio', 54, canvas.height - 72);
      frame += 1;
      onProgress(Math.round((frame / totalFrames) * 100));
      if (frame <= totalFrames) {
        window.setTimeout(draw, 1000 / fps);
      } else {
        resolve();
      }
    };
    draw();
  });

  recorder.stop();
  return done;
}

function PreviewPane() {
  const { project, ui, seek, setPlaying } = useProjectStore();
  const clips = project?.clips ?? [];
  const activeClip = currentClip(clips, ui.playhead);
  const progress = progressForClip(activeClip, ui.playhead);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const style = useMemo(() => {
    if (!activeClip) return {};
    const viewport = computeViewportAtTime(activeClip.kenburns, ui.playhead - activeClip.startTime, activeClip.duration);
    return {
      transform: `scale(${viewport.zoom}) translate(${(0.5 - viewport.x) * 100}%, ${(0.5 - viewport.y) * 100}%)`,
      transition: ui.isPlaying ? 'transform 120ms linear' : 'transform 220ms ease',
    };
  }, [activeClip, ui.isPlaying, ui.playhead]);

  async function handleExport(): Promise<void> {
    if (!project || project.clips.length === 0) {
      toast.error('Import at least one image before exporting.');
      return;
    }
    setExportProgress(0);
    setPlaying(false);
    try {
      const blob = await exportTimeline(project.clips, totalDuration(project), setExportProgress);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      toast.success('Browser export complete. Download the reel as WebM.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExportProgress(null);
    }
  }

  return (
    <section className="studio-card preview-card">
      <div className="preview-header">
        <div>
          <p className="eyebrow">9:16 live preview</p>
          <h2>{activeClip ? `Clip ${activeClip.order + 1}` : 'Import photos to begin'}</h2>
        </div>
        <div className="preview-actions">
          <button className="ghost-btn" onClick={() => seek(0)}>Reset</button>
          <button className="primary-btn" onClick={handleExport}><FileVideo size={18} /> Export</button>
        </div>
      </div>
      <div className="phone-frame">
        <div className="safe-lines" />
        {activeClip ? (
          <img alt="Animated reel preview" src={activeClip.imageUrl} style={style} />
        ) : (
          <div className="empty-preview"><UploadCloud size={48} /><span>Drop images or tap import</span></div>
        )}
        <div className="preview-overlay">
          <strong>{project?.name ?? 'New Reel'}</strong>
          <span>{Math.round(progress * 100)}% through current shot</span>
        </div>
      </div>
      {exportProgress !== null && (
        <div className="progress-block"><div style={{ width: `${exportProgress}%` }} /><span>Rendering frames: {exportProgress}%</span></div>
      )}
      {downloadUrl && (
        <a className="download-btn" href={downloadUrl} download="kenburns-reel-studio.webm"><Download size={18} /> Download exported reel</a>
      )}
    </section>
  );
}

function ImportPanel() {
  const { addClipFromFile, addAudioTrackFromFile } = useProjectStore();
  return (
    <section className="studio-card import-card">
      <label className="import-zone">
        <ImagePlus size={28} />
        <strong>Import still images</strong>
        <span>JPG, PNG, or WebP. Each image gets a Ken Burns preset automatically.</span>
        <input type="file" accept="image/*" multiple onChange={(event) => void Promise.all(Array.from(event.target.files ?? []).map(addClipFromFile))} />
      </label>
      <label className="import-zone compact">
        <Music size={24} />
        <strong>Add music</strong>
        <span>Preview audio on the editor timeline.</span>
        <input type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addAudioTrackFromFile(file); }} />
      </label>
    </section>
  );
}

function Timeline() {
  const { project, ui, seek, setSelectedClip, removeClip, addTransition, setPlaying, setTimelineZoom } = useProjectStore();
  const duration = totalDuration(project);
  const clips = project?.clips ?? [];
  const audioTracks = project?.audioTracks ?? [];
  const width = Math.max(680, (duration / 1000) * 96 * ui.timelineZoom);

  return (
    <section className="studio-card timeline-card">
      <div className="timeline-toolbar">
        <button className="round-btn" onClick={() => setPlaying(!ui.isPlaying)}>{ui.isPlaying ? <Pause /> : <Play />}</button>
        <div><strong>{formatTime(ui.playhead)}</strong><span> / {formatTime(duration)}</span></div>
        <input aria-label="Timeline scrubber" min={0} max={duration || 1} value={ui.playhead} onChange={(event) => seek(Number(event.target.value))} type="range" />
        <label>Zoom <input min={0.5} max={4} step={0.25} value={ui.timelineZoom} type="range" onChange={(event) => setTimelineZoom(Number(event.target.value))} /></label>
      </div>
      <div className="timeline-scroll">
        <div className="timeline-stage" style={{ width }}>
          <div className="playhead" style={{ left: duration ? `${(ui.playhead / duration) * 100}%` : 0 }} />
          <div className="track-label">Video</div>
          <div className="clip-row">
            {clips.map((clip, index) => {
              const percentWidth = duration ? (clip.duration / duration) * 100 : 0;
              return (
                <button key={clip.id} className={`clip-block ${ui.selectedClipId === clip.id ? 'selected' : ''}`} style={{ width: `${percentWidth}%` }} onClick={() => setSelectedClip(clip.id)}>
                  <img src={clip.thumbnail ?? clip.imageUrl} alt="" />
                  <span>Shot {index + 1}</span>
                  <small>{formatTime(clip.duration)}</small>
                  <button className="mini-delete" onClick={(event) => { event.stopPropagation(); removeClip(clip.id); }}><Trash2 size={14} /></button>
                  {index < clips.length - 1 && (
                    <button className="transition-chip" onClick={(event) => { event.stopPropagation(); addTransition(clip.id, clips[index + 1].id); }}><Scissors size={13} /> Transition</button>
                  )}
                </button>
              );
            })}
          </div>
          <div className="track-label audio-label">Audio</div>
          <div className="audio-row">
            {audioTracks.length === 0 ? <span className="track-empty">No music track yet</span> : audioTracks.map((track) => (
              <div key={track.id} className="audio-block" style={{ width: duration ? `${Math.min(100, (track.duration / duration) * 100)}%` : '100%' }}><Music size={14} />{track.name}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ClipInspector() {
  const { project, ui, updateClipDuration, updateClipKenBurns, applyPreset, removeClip } = useProjectStore();
  const clip = project?.clips.find((item) => item.id === ui.selectedClipId) ?? project?.clips[0];
  if (!clip) return <section className="studio-card inspector"><h3>No shot selected</h3><p>Import photos to reveal shot timing, viewport, and motion controls.</p></section>;
  const kb = clip.kenburns;
  return (
    <section className="studio-card inspector">
      <div className="inspector-header"><div><p className="eyebrow">Shot controls</p><h3>Clip {clip.order + 1}</h3></div><button className="danger-btn" onClick={() => removeClip(clip.id)}><Trash2 size={16} /> Remove</button></div>
      <label>Duration <strong>{(clip.duration / 1000).toFixed(1)}s</strong><input type="range" min={MIN_CLIP_DURATION_MS} max={MAX_CLIP_DURATION_MS} step={250} value={clip.duration} onChange={(event) => updateClipDuration(clip.id, Number(event.target.value))} /></label>
      <div className="preset-grid">
        {MOTION_PRESETS.map((preset) => <button key={preset.id} className={kb.preset === preset.id ? 'preset active' : 'preset'} onClick={() => applyPreset(clip.id, preset.id)}><Wand2 size={14} />{preset.label}<small>{preset.bestFor}</small></button>)}
      </div>
      <div className="viewport-grid">
        {(['startViewport', 'endViewport'] as const).map((key) => (
          <div className="viewport-box" key={key}>
            <h4>{key === 'startViewport' ? 'Start frame' : 'End frame'}</h4>
            {(['x', 'y', 'zoom'] as const).map((axis) => (
              <label key={axis}>{axis.toUpperCase()} <span>{kb[key][axis].toFixed(2)}</span><input type="range" min={axis === 'zoom' ? 1 : 0} max={axis === 'zoom' ? 2.5 : 1} step={0.01} value={kb[key][axis]} onChange={(event) => updateClipKenBurns(clip.id, { ...kb, preset: 'custom', [key]: { ...kb[key], [axis]: Number(event.target.value) } })} /></label>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function TransitionInspector() {
  const { project, updateTransition } = useProjectStore();
  const transitions = project?.transitions ?? [];
  return (
    <section className="studio-card inspector small-inspector">
      <p className="eyebrow">Transitions</p>
      <h3>Blend shots</h3>
      {transitions.length === 0 ? <p>Add transitions from the timeline between adjacent clips.</p> : transitions.map((transition) => (
        <div className="transition-editor" key={transition.id}>
          <select value={transition.type} onChange={(event) => updateTransition(transition.id, { type: event.target.value as TransitionType })}>{transitionTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select>
          <label>{transition.duration}ms<input type="range" min={MIN_TRANSITION_DURATION_MS} max={MAX_TRANSITION_DURATION_MS} step={100} value={transition.duration} onChange={(event) => updateTransition(transition.id, { duration: Number(event.target.value) })} /></label>
        </div>
      ))}
    </section>
  );
}

function AudioInspector() {
  const { project, updateAudioTrack, removeAudioTrack } = useProjectStore();
  const audioTracks = project?.audioTracks ?? [];
  return (
    <section className="studio-card inspector small-inspector">
      <p className="eyebrow">Music bed</p>
      <h3>Audio mix</h3>
      {audioTracks.length === 0 ? <p>Add a song or voiceover to control volume and fades.</p> : audioTracks.map((track: AudioTrack) => (
        <div className="audio-editor" key={track.id}>
          <audio src={track.url} controls />
          <strong>{track.name}</strong>
          <label>Volume {(track.volume * 100).toFixed(0)}%<input type="range" min={0} max={1} step={0.01} value={track.volume} onChange={(event) => updateAudioTrack(track.id, { volume: Number(event.target.value) })} /></label>
          <label><input type="checkbox" checked={track.muted} onChange={(event) => updateAudioTrack(track.id, { muted: event.target.checked })} /> Mute in preview</label>
          <button className="ghost-btn" onClick={() => removeAudioTrack(track.id)}>Remove audio</button>
        </div>
      ))}
    </section>
  );
}

export default function Editor() {
  const { project, ui, createProject, seek, setPlaying, undo, redo, persistNow } = useProjectStore();
  const raf = useRef<number | null>(null);
  const duration = totalDuration(project);

  useEffect(() => {
    if (!project) createProject('Instagram Reel');
  }, [createProject, project]);

  useEffect(() => {
    if (!ui.isPlaying) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return undefined;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      const next = ui.playhead + delta;
      if (next >= duration) {
        seek(0);
        setPlaying(false);
      } else {
        seek(next);
        raf.current = requestAnimationFrame(tick);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [duration, seek, setPlaying, ui.isPlaying, ui.playhead]);

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <Link href="/" className="brand"><Sparkles /> Ken Burns Reel Studio</Link>
        <div className="topbar-actions">
          <button className="ghost-btn" onClick={undo}><RotateCcw size={16} /> Undo</button>
          <button className="ghost-btn" onClick={redo}><RotateCw size={16} /> Redo</button>
          <button className="primary-btn" onClick={() => void persistNow().then(() => toast.success('Project saved locally'))}><Save size={16} /> Save</button>
        </div>
      </header>
      <div className="workspace-grid">
        <aside className="left-rail"><ImportPanel /><TransitionInspector /><AudioInspector /></aside>
        <div className="center-stage"><PreviewPane /><Timeline /></div>
        <aside className="right-rail"><ClipInspector /></aside>
      </div>
      <footer className="studio-footer"><Plus size={14} /> Built for mobile Reels: 1080×1920, 30fps preview, persistent projects, image timeline, music, transitions, and browser export.</footer>
    </main>
  );
}
