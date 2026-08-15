import { EventHandler } from '@/game/utilities/event-handler';
import { LogHandler } from '@/game/utilities/log-handler';
import workletModuleUrl from './audio-worklet-processor?worker&url';
import {
  OPL_WORKLET_PROCESSOR_NAME,
  type AudioWorkletCommand,
  type AudioWorkletEvent,
} from './audio-worklet-protocol';
import type { SoundImagePlayer } from './sound-image-player';

export type AudioPlayerState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'unavailable';

export interface AudioContextLike {
  readonly audioWorklet: { addModule(moduleUrl: string | URL): Promise<void> };
  readonly destination: unknown;
  readonly state: AudioContextState;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}

export interface AudioWorkletNodeLike {
  readonly port: {
    onmessage: ((event: MessageEvent<AudioWorkletEvent>) => void) | null;
    postMessage(message: AudioWorkletCommand, transfer?: Transferable[]): void;
  };
  onprocessorerror: ((event: ErrorEvent) => void) | null;
  connect(destination: unknown): unknown;
  disconnect(): void;
}

export interface GainNodeLike {
  connect(destination: unknown): unknown;
  disconnect(): void;
}

export interface AudioPlayerDependencies {
  createContext(): AudioContextLike;
  createWorkletNode(context: AudioContextLike): AudioWorkletNodeLike;
  createGainNode(context: AudioContextLike): GainNodeLike;
  workletModuleUrl: string | URL;
}

const defaultDependencies: AudioPlayerDependencies = {
  createContext: () => new AudioContext(),
  createWorkletNode: (context) => new AudioWorkletNode(
    context as AudioContext,
    OPL_WORKLET_PROCESSOR_NAME,
    {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    },
  ),
  createGainNode: (context) => (context as AudioContext).createGain(),
  workletModuleUrl,
};

/** Main-thread lifecycle controller for the OPL AudioWorklet. */
export class AudioPlayer {
  private readonly log = new LogHandler('AudioPlayer');
  private context: AudioContextLike | null = null;
  private workletNode: AudioWorkletNodeLike | null = null;
  private gainNode: GainNodeLike | null = null;
  private initialization: Promise<boolean> | null = null;
  private disposed = false;
  private currentState: AudioPlayerState = 'idle';
  private currentVolume = 1;
  private lastError = '';

  public readonly onStateChanged = new EventHandler<AudioPlayerState>();

  constructor(
    private readonly source: SoundImagePlayer | Promise<SoundImagePlayer>,
    private readonly dependencies: AudioPlayerDependencies = defaultDependencies,
  ) {}

  public get state(): AudioPlayerState {
    return this.currentState;
  }

  public get errorMessage(): string {
    return this.lastError;
  }

  public get volume(): number {
    return this.currentVolume;
  }

  public set volume(value: number) {
    this.setVolume(value);
  }

  /** Initialize and start audio. Call this directly from a player gesture. */
  public async play(): Promise<boolean> {
    if (this.disposed) {
      return false;
    }

    const initialized = await this.ensureInitialized();
    if (this.disposed || !initialized || !this.context || !this.workletNode) {
      return false;
    }

    try {
      if (this.context.state !== 'running') {
        await this.context.resume();
      }
      if (this.disposed || !this.context || !this.workletNode) {
        return false;
      }
      this.send({ type: 'play' });
      this.setState('playing');
      return true;
    } catch (error) {
      this.markUnavailable(error);
      return false;
    }
  }

  public async pause(): Promise<void> {
    if (!this.context || !this.workletNode || this.disposed) {
      return;
    }

    this.send({ type: 'pause' });
    await this.context.suspend().catch((error: unknown) => this.markUnavailable(error));
    if (!this.disposed && this.currentState !== 'unavailable') {
      this.setState('paused');
    }
  }

  /** Compatibility alias retained for existing callers. */
  public suspend(): Promise<void> {
    return this.pause();
  }

  public setVolume(value: number): void {
    if (!Number.isFinite(value)) {
      throw new RangeError('Audio volume must be a finite number');
    }
    this.currentVolume = Math.min(1, Math.max(0, value));
    this.send({ type: 'volume', value: this.currentVolume });
  }

  /** Stop permanently and release the AudioContext and worklet resources. */
  public stop(): void {
    void this.dispose();
  }

  public async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.send({ type: 'stop' });
    this.send({ type: 'dispose' });
    this.workletNode?.disconnect();
    this.gainNode?.disconnect();
    this.workletNode = null;
    this.gainNode = null;

    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') {
      await context.close().catch((error: unknown) => {
        this.log.debug(error instanceof Error ? error : String(error));
      });
    }

    this.setState('stopped');
    this.onStateChanged.dispose();
  }

  private ensureInitialized(): Promise<boolean> {
    if (this.initialization) {
      return this.initialization;
    }

    const initialization = this.initialize();
    this.initialization = initialization;
    void initialization.then((initialized) => {
      if (!initialized && this.initialization === initialization) {
        this.initialization = null;
      }
    });
    return initialization;
  }

  private async initialize(): Promise<boolean> {
    this.lastError = '';
    this.setState('loading');

    try {
      const context = this.dependencies.createContext();
      this.context = context;

      // resume() is deliberately called before the first await after context
      // creation so a click/tap remains an eligible autoplay gesture.
      const resumePromise = context.resume();
      const [source] = await Promise.all([
        this.source,
        resumePromise,
        context.audioWorklet.addModule(this.dependencies.workletModuleUrl),
      ]);

      if (this.disposed) {
        if (context.state !== 'closed') {
          await context.close();
        }
        return false;
      }

      const workletNode = this.dependencies.createWorkletNode(context);
      const gainNode = this.dependencies.createGainNode(context);
      workletNode.port.onmessage = (event) => this.handleWorkletEvent(event.data);
      workletNode.onprocessorerror = () => {
        this.markUnavailable(new Error('The audio processor stopped unexpectedly'));
      };
      workletNode.connect(gainNode);
      gainNode.connect(context.destination);
      this.workletNode = workletNode;
      this.gainNode = gainNode;

      const playback = source.createPlaybackData();
      this.send({ type: 'load', playback }, [playback.data]);
      this.send({ type: 'volume', value: this.currentVolume });
      return true;
    } catch (error) {
      this.markUnavailable(error);
      const context = this.context;
      this.context = null;
      if (context && context.state !== 'closed') {
        await context.close().catch(() => undefined);
      }
      return false;
    }
  }

  private handleWorkletEvent(event: AudioWorkletEvent): void {
    if (event.type === 'error') {
      this.markUnavailable(new Error(event.message));
    }
  }

  private send(command: AudioWorkletCommand, transfer?: Transferable[]): void {
    this.workletNode?.port.postMessage(command, transfer);
  }

  private markUnavailable(error: unknown): void {
    if (this.disposed) {
      return;
    }
    this.lastError = error instanceof Error ? error.message : 'Audio is unavailable';
    this.log.debug(this.lastError);
    this.setState('unavailable');
  }

  private setState(state: AudioPlayerState): void {
    if (this.currentState === state) {
      return;
    }
    this.currentState = state;
    this.onStateChanged.trigger(state);
  }
}
