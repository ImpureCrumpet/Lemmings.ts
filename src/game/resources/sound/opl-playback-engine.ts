import { OPL } from './DBOPL/db-opl3';
import type { IOpl3 } from './opl3';
import type { AdlibCommandCallback } from './sound-image-player';

export interface AdlibCommandSource {
  getSamplingInterval(): number;
  read(commandCallback: AdlibCommandCallback): void;
}

export type OplFactory = (sampleRate: number, channels: number) => IOpl3;

/** Device-rate-aware, browser-independent sample generation used by the worklet. */
export class OplPlaybackEngine {
  private readonly opl: IOpl3;
  private readonly samplesPerTick: number;
  private samplesUntilTick = 0;
  private volume = 1;

  constructor(
    private readonly source: AdlibCommandSource,
    sampleRate: number,
    oplFactory: OplFactory = (rate, channels) => new OPL(rate, channels),
  ) {
    const samplingInterval = source.getSamplingInterval();
    if (!Number.isFinite(samplingInterval) || samplingInterval <= 0) {
      throw new Error(`Invalid Sound Image sampling interval: ${samplingInterval}`);
    }

    this.samplesPerTick = Math.max(1, Math.round(sampleRate / samplingInterval));
    this.opl = oplFactory(sampleRate, 2);
  }

  public setVolume(value: number): void {
    this.volume = Math.min(1, Math.max(0, value));
  }

  public render(left: Float32Array, right: Float32Array): void {
    const frameCount = Math.min(left.length, right.length);
    let outputPosition = 0;

    while (outputPosition < frameCount) {
      if (this.samplesUntilTick <= 0) {
        this.source.read((register, value) => this.opl.write(register, value));
        this.samplesUntilTick += this.samplesPerTick;
      }

      const generatedFrames = Math.min(
        512,
        this.samplesUntilTick,
        frameCount - outputPosition,
      );
      const samples = this.opl.generate(generatedFrames);

      for (let frame = 0; frame < generatedFrames; frame++) {
        left[outputPosition] = samples[frame * 2] / 32768 * this.volume;
        right[outputPosition] = samples[frame * 2 + 1] / 32768 * this.volume;
        outputPosition++;
      }

      this.samplesUntilTick -= generatedFrames;
    }

    left.fill(0, frameCount);
    right.fill(0, frameCount);
  }
}
