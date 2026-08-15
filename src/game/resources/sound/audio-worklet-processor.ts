import {
  OPL_WORKLET_PROCESSOR_NAME,
  type AudioWorkletCommand,
  type AudioWorkletEvent,
} from './audio-worklet-protocol';
import { OplPlaybackEngine } from './opl-playback-engine';
import { SoundImagePlayer } from './sound-image-player';

declare const sampleRate: number;

declare abstract class AudioWorkletProcessor {
  public readonly port: MessagePort;
  public abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processorCtor: new () => AudioWorkletProcessor,
): void;

class LemmingsOplProcessor extends AudioWorkletProcessor {
  private engine: OplPlaybackEngine | null = null;
  private playing = false;
  private disposed = false;
  private volume = 1;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<AudioWorkletCommand>) => {
      this.handleCommand(event.data);
    };
  }

  public process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    if (this.disposed) {
      return false;
    }

    const output = outputs[0];
    const left = output?.[0];
    if (!left) {
      return true;
    }

    const right = output[1] ?? new Float32Array(left.length);
    if (!this.playing || !this.engine) {
      left.fill(0);
      right.fill(0);
      return true;
    }

    this.engine.render(left, right);
    return true;
  }

  private handleCommand(command: AudioWorkletCommand): void {
    try {
      switch (command.type) {
        case 'load': {
          const source = SoundImagePlayer.fromPlaybackData(command.playback);
          this.engine = new OplPlaybackEngine(source, sampleRate);
          this.engine.setVolume(this.volume);
          this.send({ type: 'ready' });
          break;
        }
        case 'play':
          this.playing = true;
          break;
        case 'pause':
        case 'stop':
          this.playing = false;
          break;
        case 'volume':
          this.volume = Math.min(1, Math.max(0, command.value));
          this.engine?.setVolume(this.volume);
          break;
        case 'dispose':
          this.playing = false;
          this.engine = null;
          this.disposed = true;
          this.port.close();
          break;
      }
    } catch (error) {
      this.playing = false;
      this.engine = null;
      this.send({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unable to initialize audio',
      });
    }
  }

  private send(event: AudioWorkletEvent): void {
    this.port.postMessage(event);
  }
}

registerProcessor(OPL_WORKLET_PROCESSOR_NAME, LemmingsOplProcessor);
