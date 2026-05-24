/**
 * Minimal WebCodecs type declarations for Ken Burns Reel Studio.
 * These types are needed because TypeScript's built-in DOM types
 * don't yet include WebCodecs API declarations.
 */

declare class VideoEncoder {
  constructor(init: {
    output: (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata) => void;
    error: (error: DOMException) => void;
  });
  configure(config: VideoEncoderConfig): void;
  encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions): void;
  flush(): Promise<void>;
  close(): void;
  readonly state: 'unconfigured' | 'configured' | 'closed';
}

declare class AudioEncoder {
  constructor(init: {
    output: (chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) => void;
    error: (error: DOMException) => void;
  });
  configure(config: AudioEncoderConfig): void;
  encode(data: AudioData): void;
  flush(): Promise<void>;
  close(): void;
  readonly state: 'unconfigured' | 'configured' | 'closed';
}

declare class VideoFrame {
  constructor(source: CanvasImageSource | OffscreenCanvas, init?: VideoFrameInit);
  close(): void;
  readonly timestamp: number;
  readonly duration: number | null;
  readonly codedWidth: number;
  readonly codedHeight: number;
}

interface VideoFrameInit {
  timestamp: number;
  duration?: number;
}

interface VideoEncoderConfig {
  codec: string;
  width: number;
  height: number;
  bitrate?: number;
  framerate?: number;
  hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
}

interface AudioEncoderConfig {
  codec: string;
  numberOfChannels: number;
  sampleRate: number;
  bitrate?: number;
}

interface VideoEncoderEncodeOptions {
  keyFrame?: boolean;
}

interface EncodedVideoChunk {
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;
  copyTo(destination: ArrayBufferView): void;
}

interface EncodedVideoChunkMetadata {
  decoderConfig?: VideoDecoderConfig;
}

interface VideoDecoderConfig {
  codec: string;
  codedWidth?: number;
  codedHeight?: number;
  description?: ArrayBuffer;
}

interface EncodedAudioChunk {
  readonly type: 'key' | 'delta';
  readonly timestamp: number;
  readonly duration: number | null;
  readonly byteLength: number;
  copyTo(destination: ArrayBufferView): void;
}

interface EncodedAudioChunkMetadata {
  decoderConfig?: AudioDecoderConfig;
}

interface AudioDecoderConfig {
  codec: string;
  numberOfChannels: number;
  sampleRate: number;
}

declare class AudioData {
  constructor(init: AudioDataInit);
  close(): void;
  readonly format: AudioSampleFormat;
  readonly sampleRate: number;
  readonly numberOfFrames: number;
  readonly numberOfChannels: number;
  readonly duration: number;
  readonly timestamp: number;
  copyTo(destination: ArrayBufferView, options: AudioDataCopyToOptions): void;
}

interface AudioDataInit {
  format: AudioSampleFormat;
  sampleRate: number;
  numberOfFrames: number;
  numberOfChannels: number;
  timestamp: number;
  data: ArrayBufferView;
}

type AudioSampleFormat = 'u8' | 's16' | 's32' | 'f32' | 'u8-planar' | 's16-planar' | 's32-planar' | 'f32-planar';

interface AudioDataCopyToOptions {
  planeIndex: number;
  format?: AudioSampleFormat;
}
