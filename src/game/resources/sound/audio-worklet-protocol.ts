import type { SoundImagePlaybackData } from './sound-image-player';

export const OPL_WORKLET_PROCESSOR_NAME = 'lemmings-opl-processor';

export type AudioWorkletCommand =
  | { type: 'load'; playback: SoundImagePlaybackData }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'volume'; value: number }
  | { type: 'dispose' };

export type AudioWorkletEvent =
  | { type: 'ready' }
  | { type: 'error'; message: string };
