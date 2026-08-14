import { describe, expect, it, vi } from 'vitest';
import { LevelConfig } from '@/game/config/level-config';
import { GameTypes, GameTypesHelper } from '@/game/game-types';
import { Frame } from '@/game/resources/frame';
import { SkillPanelSprites } from '@/game/resources/skill-panel-sprites';
import { EventHandler } from '@/game/utilities/event-handler';
import { DisplayImage } from '@/game/view/display-image';
import type { Stage } from '@/game/view/stage';

describe('core helpers', () => {
  it('maps supported game names and values', () => {
    expect(GameTypesHelper.fromString(' holiday94 ')).toBe(GameTypes.HOLIDAY94);
    expect(GameTypesHelper.toString(GameTypes.OHNO)).toBe('OHNO');
    expect(GameTypesHelper.isValid(GameTypes.UNKNOWN)).toBe(false);
  });

  it('reports safe level-group lengths', () => {
    const config = new LevelConfig();
    config.order = [[1, 2], [3]];

    expect(config.getGroupLength(0)).toBe(2);
    expect(config.getGroupLength(2)).toBe(0);
    expect(config.getGroupLength(-1)).toBe(0);
  });

  it('subscribes and unsubscribes event listeners', () => {
    const handler = new EventHandler<number>();
    const listener = vi.fn();

    handler.on(listener);
    handler.trigger(42);
    handler.off(listener);
    handler.trigger(7);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(42);
  });

  it('accepts only supported toolbar artwork dimensions', () => {
    expect(SkillPanelSprites.getPanelScale(320, 40)).toBe(1);
    expect(SkillPanelSprites.getPanelScale(640, 80)).toBe(2);
    expect(SkillPanelSprites.getPanelScale(960, 120)).toBe(3);
    expect(SkillPanelSprites.getPanelScale(1280, 160)).toBe(4);
    expect(SkillPanelSprites.getPanelScale(640, 40)).toBeUndefined();
    expect(SkillPanelSprites.getPanelScale(800, 100)).toBeUndefined();
  });

  it('scales toolbar overlay frames without smoothing', () => {
    const stage = {
      createImage: (_display: DisplayImage, width: number, height: number) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }) as ImageData,
    } as Stage;
    const display = new DisplayImage(stage);
    const pixel = new Frame(1, 1);
    pixel.fill(255, 0, 0);

    display.initSize(2, 2);
    display.drawFrame(pixel, 0, 0, 2);

    const data = display.getImageData()?.data;
    expect(data && Array.from(data)).toEqual([
      255, 0, 0, 255,
      255, 0, 0, 255,
      255, 0, 0, 255,
      255, 0, 0, 255,
    ]);
  });
});
