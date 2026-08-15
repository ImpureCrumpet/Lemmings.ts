import { describe, expect, it, vi } from 'vitest';
import {
  AudioPlayer,
  type AudioContextLike,
  type AudioPlayerDependencies,
  type AudioWorkletNodeLike,
  type GainNodeLike,
} from '@/game/resources/sound/audio-player';
import type { AudioWorkletCommand } from '@/game/resources/sound/audio-worklet-protocol';
import { OPL } from '@/game/resources/sound/DBOPL/db-opl3';
import type { IOpl3 } from '@/game/resources/sound/opl3';
import {
  OplPlaybackEngine,
  type AdlibCommandSource,
} from '@/game/resources/sound/opl-playback-engine';
import type { SoundImagePlayer } from '@/game/resources/sound/sound-image-player';

class RecordingOpl implements IOpl3 {
  public readonly writes: Array<[number, number]> = [];
  public readonly generationSizes: number[] = [];
  private value = 0;

  public write(register: number, value: number): void {
    this.writes.push([register, value]);
    this.value = value;
  }

  public generate(frameCount: number): Int16Array {
    this.generationSizes.push(frameCount);
    const samples = new Int16Array(frameCount * 2);
    for (let frame = 0; frame < frameCount; frame++) {
      samples[frame * 2] = this.value;
      samples[frame * 2 + 1] = -this.value;
    }
    return samples;
  }
}

describe('OplPlaybackEngine', () => {
  it('applies commands at device-rate sample boundaries and fills stereo frames', () => {
    let tick = 0;
    const source: AdlibCommandSource = {
      getSamplingInterval: () => 100,
      read: (write) => {
        tick++;
        write(0x20, tick * 100);
      },
    };
    const opl = new RecordingOpl();
    const engine = new OplPlaybackEngine(source, 400, () => opl);
    engine.setVolume(0.5);
    const left = new Float32Array(10);
    const right = new Float32Array(10);

    engine.render(left, right);

    expect(opl.writes).toEqual([[0x20, 100], [0x20, 200], [0x20, 300]]);
    expect(opl.generationSizes).toEqual([4, 4, 2]);
    expect(left[0]).toBeCloseTo(50 / 32768);
    expect(left[4]).toBeCloseTo(100 / 32768);
    expect(left[8]).toBeCloseTo(150 / 32768);
    expect(right[8]).toBeCloseTo(-150 / 32768);
  });

  it('generates exact one-sample intervals without crossing a command boundary', () => {
    const source: AdlibCommandSource = {
      getSamplingInterval: () => 100,
      read: (write) => write(1, 2),
    };
    const opl = new RecordingOpl();
    const engine = new OplPlaybackEngine(source, 100, () => opl);

    engine.render(new Float32Array(3), new Float32Array(3));

    expect(opl.generationSizes).toEqual([1, 1, 1]);
    expect(opl.writes).toHaveLength(3);
  });

  it('produces deterministic non-silent frames for a known OPL register sequence', () => {
    const renderTone = (): Int16Array => {
      const opl = new OPL(44_100, 2);
      [
        [0x20, 0x01], [0x23, 0x01], [0x40, 0x10], [0x43, 0x00],
        [0x60, 0xf0], [0x63, 0xf0], [0x80, 0x77], [0x83, 0x77],
        [0xc0, 0x01], [0xa0, 0x98], [0xb0, 0x31],
      ].forEach(([register, value]) => opl.write(register, value));
      return opl.generate(128).slice(0, 256);
    };

    const first = renderTone();
    const second = renderTone();
    expect(first).toEqual(second);
    expect(first.some((sample) => sample !== 0)).toBe(true);
  });
});

describe('AudioPlayer', () => {
  function createHarness(sourceOverride?: Promise<SoundImagePlayer>) {
    const commands: Array<{ command: AudioWorkletCommand; transfer?: Transferable[] }> = [];
    const addModule = vi.fn(async () => undefined);
    const resume = vi.fn(async () => {
      contextState = 'running';
    });
    const suspend = vi.fn(async () => { contextState = 'suspended'; });
    const close = vi.fn(async () => { contextState = 'closed'; });
    let contextState: AudioContextState = 'suspended';

    const context: AudioContextLike = {
      audioWorklet: { addModule },
      destination: {},
      get state() { return contextState; },
      resume,
      suspend,
      close,
    };
    const workletNode: AudioWorkletNodeLike = {
      port: {
        onmessage: null,
        postMessage: (command, transfer) => commands.push({ command, transfer }),
      },
      onprocessorerror: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const gainNode: GainNodeLike = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const dependencies: AudioPlayerDependencies = {
      createContext: () => {
        contextState = 'suspended';
        return context;
      },
      createWorkletNode: () => workletNode,
      createGainNode: () => gainNode,
      workletModuleUrl: new URL('https://example.test/audio-worklet.js'),
    };
    const playbackData = {
      data: new ArrayBuffer(4),
      audioConfig: {
        soundIndexTablePosition: 0,
        adlibChannelConfigPosition: 0,
        version: 2,
        dataOffset: 0,
        frequenciesOffset: 0,
        octavesOffset: 0,
        frequenciesCountOffset: 0,
        instructionsOffset: 0,
        soundDataOffset: 0,
        numberOfTracks: 1,
      },
      trackType: 'music' as const,
      trackIndex: 0,
    };
    const source = {
      createPlaybackData: vi.fn(() => playbackData),
    } as unknown as SoundImagePlayer;

    return {
      player: new AudioPlayer(sourceOverride ?? source, dependencies),
      source,
      commands,
      addModule,
      resume,
      suspend,
      close,
      workletNode,
      gainNode,
    };
  }

  it('loads once, transports commands, clamps volume, and disposes idempotently', async () => {
    const harness = createHarness();

    expect(await harness.player.play()).toBe(true);
    harness.player.setVolume(2);
    await harness.player.pause();
    expect(await harness.player.play()).toBe(true);
    await harness.player.dispose();
    await harness.player.dispose();

    expect(harness.addModule).toHaveBeenCalledTimes(1);
    expect(harness.resume).toHaveBeenCalledTimes(2);
    expect(harness.suspend).toHaveBeenCalledTimes(1);
    expect(harness.close).toHaveBeenCalledTimes(1);
    expect(harness.commands.map(({ command }) => command.type)).toEqual([
      'load', 'volume', 'play', 'volume', 'pause', 'play', 'stop', 'dispose',
    ]);
    expect(harness.commands[0].transfer).toHaveLength(1);
    expect(harness.commands[3].command).toEqual({ type: 'volume', value: 1 });
    expect(harness.workletNode.disconnect).toHaveBeenCalledTimes(1);
    expect(harness.gainNode.disconnect).toHaveBeenCalledTimes(1);
    expect(harness.player.state).toBe('stopped');
  });

  it('reports unavailable audio without throwing when autoplay resume fails', async () => {
    const harness = createHarness();
    harness.resume.mockRejectedValueOnce(new Error('gesture required'));

    expect(await harness.player.play()).toBe(false);
    expect(harness.player.state).toBe('unavailable');
    expect(harness.player.errorMessage).toBe('gesture required');
    expect(harness.close).toHaveBeenCalledTimes(1);
    expect(harness.commands).toEqual([]);
  });

  it('resumes synchronously before a cold sound-image load resolves', async () => {
    let resolveSource: (source: SoundImagePlayer) => void = () => undefined;
    const source = new Promise<SoundImagePlayer>((resolve) => {
      resolveSource = resolve;
    });
    const harness = createHarness(source);

    const play = harness.player.play();

    expect(harness.resume).toHaveBeenCalledTimes(1);
    expect(harness.addModule).toHaveBeenCalledTimes(1);
    expect(harness.commands).toEqual([]);

    resolveSource(harness.source);
    expect(await play).toBe(true);
  });

  it('remains stopped when disposed while resume is pending', async () => {
    const harness = createHarness();
    expect(await harness.player.play()).toBe(true);
    await harness.player.pause();

    let resolveResume: () => void = () => undefined;
    harness.resume.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveResume = resolve;
    }));
    const play = harness.player.play();
    await Promise.resolve();
    await harness.player.dispose();
    resolveResume();

    expect(await play).toBe(false);
    expect(harness.player.state).toBe('stopped');
    expect(harness.commands.map(({ command }) => command.type)).toEqual([
      'load', 'volume', 'play', 'pause', 'stop', 'dispose',
    ]);
  });

  it('retries initialization on the same player after a transient failure', async () => {
    const harness = createHarness();
    harness.resume.mockRejectedValueOnce(new Error('gesture required'));

    expect(await harness.player.play()).toBe(false);
    expect(await harness.player.play()).toBe(true);

    expect(harness.resume).toHaveBeenCalledTimes(2);
    expect(harness.addModule).toHaveBeenCalledTimes(2);
    expect(harness.close).toHaveBeenCalledTimes(1);
    expect(harness.player.state).toBe('playing');
  });

  it('remains stopped when disposed while its worklet module is still loading', async () => {
    const harness = createHarness();
    let rejectModule: (error: Error) => void = () => undefined;
    harness.addModule.mockImplementation(() => new Promise<undefined>((_resolve, reject) => {
      rejectModule = reject;
    }));

    const play = harness.player.play();
    await Promise.resolve();
    await harness.player.dispose();
    rejectModule(new Error('context closed during load'));

    expect(await play).toBe(false);
    expect(harness.player.state).toBe('stopped');
    expect(harness.player.errorMessage).toBe('');
    expect(harness.close).toHaveBeenCalledTimes(1);
  });
});
