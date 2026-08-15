import { GameTypes } from '@/game/game-types';
import { Game } from '@/game/game';
import { BinaryReader } from '@/game/resources/file/binary-reader';
import { Frame } from '@/game/resources/frame';
import { Level } from '@/game/resources/level';
import type { LemmingsSprite } from '@/game/resources/lemmings-sprite';
import { ColorPalette } from '@/game/resources/lemmings/color-palette';
import { LevelProperties } from '@/game/resources/lemmings/level-properties';
import { MaskProvider } from '@/game/resources/mask-provider';
import { Animation } from '@/game/resources/animation';
import type { SkillPanelSprites } from '@/game/resources/skill-panel-sprites';
import { SolidLayer } from '@/game/resources/solid-layer';
import type { FrameScheduler } from '@/game/game-play/game-timer';

export interface SyntheticLevelOptions {
  width?: number;
  height?: number;
  releaseRate?: number;
  releaseCount?: number;
  needCount?: number;
  timeLimit?: number;
  skills?: readonly number[];
}

export function buildSyntheticLevel(options: SyntheticLevelOptions = {}): Level {
  const width = options.width ?? 64;
  const height = options.height ?? 32;
  const properties = new LevelProperties();
  properties.levelName = 'Synthetic gameplay level';
  properties.releaseRate = options.releaseRate ?? 50;
  properties.releaseCount = options.releaseCount ?? 10;
  properties.needCount = options.needCount ?? 5;
  properties.timeLimit = options.timeLimit ?? 1;
  properties.skills = [...(options.skills ?? [0, 1, 2, 3, 4, 5, 6, 7, 8])];

  const colorPalette = new ColorPalette();
  colorPalette.setMainColors();

  return new Level(
    width,
    height,
    GameTypes.LEMMINGS,
    0,
    0,
    properties,
    0,
    false,
    new Uint8ClampedArray(width * height * 4),
    new SolidLayer(width, height, new Int8Array(width * height)),
    colorPalette,
    new ColorPalette(),
  );
}

export function buildSyntheticGame(
  options: SyntheticLevelOptions = {},
  frameScheduler?: FrameScheduler,
): Game {
  return new Game(
    buildSyntheticLevel(options),
    createFilledMaskProvider(),
    createStubSprites(),
    {} as SkillPanelSprites,
    frameScheduler,
  );
}

export function advanceTicks(timer: { tick(): void }, count: number): void {
  for (let tick = 0; tick < count; tick++) {
    timer.tick();
  }
}

export function createStubSprites(): LemmingsSprite {
  const animation = new Animation();
  animation.frames.push(new Frame(1, 1));
  return { getAnimation: () => animation } as unknown as LemmingsSprite;
}

export function createFilledMaskProvider(): MaskProvider {
  // The classic mask table consumes 388 bytes in total. Filled bits make every
  // mask pixel destructive, which keeps terrain expectations easy to inspect.
  return new MaskProvider(new BinaryReader(new Uint8Array(388).fill(0xff), null, null, 'synthetic-masks.dat'));
}

export function fillGround(level: Level, x1: number, y1: number, x2: number, y2: number): void {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      level.setGroundAt(x, y, 7);
    }
  }
}
