import { describe, expect, it } from 'vitest';
import { ActionBashSystem } from '@/game/game-play/actions/action-bash-system';
import { ActionBlockerSystem } from '@/game/game-play/actions/action-blocker-system';
import { ActionBuildSystem } from '@/game/game-play/actions/action-build-system';
import { ActionClimbSystem } from '@/game/game-play/actions/action-climb-system';
import { ActionCountdownSystem } from '@/game/game-play/actions/action-countdown-system';
import { ActionDiggSystem } from '@/game/game-play/actions/action-digg-system';
import { ActionDrowningSystem } from '@/game/game-play/actions/action-drowning-system';
import { ActionExitingSystem } from '@/game/game-play/actions/action-exiting-system';
import { ActionFallSystem } from '@/game/game-play/actions/action-fall-system';
import { ActionFloatingSystem } from '@/game/game-play/actions/action-floating-system';
import { ActionMineSystem } from '@/game/game-play/actions/action-mine-system';
import { ActionSplatterSystem } from '@/game/game-play/actions/action-splatter-system';
import { ActionWalkSystem } from '@/game/game-play/actions/action-walk-system';
import { GameTimer } from '@/game/game-play/game-timer';
import { GameVictoryCondition } from '@/game/game-play/game-victory-condition';
import { Lemming } from '@/game/game-play/lemming';
import { LemmingStateType } from '@/game/game-play/lemming-state-type';
import { Trigger } from '@/game/game-play/trigger';
import { TriggerManager } from '@/game/game-play/trigger-manager';
import { TriggerTypes } from '@/game/resources/lemmings/trigger-types';
import { Mask } from '@/game/resources/mask';
import { MaskList } from '@/game/resources/mask-list';
import { MaskTypes } from '@/game/resources/mask-types';
import {
  buildSyntheticLevel,
  createFilledMaskProvider,
  createStubSprites,
  fillGround,
} from '../fixtures/gameplay-fixtures';

describe('permanent and timed skills', () => {
  it('assigns climber and floater once per lemming', () => {
    const sprites = createStubSprites();
    const climber = new ActionClimbSystem(sprites);
    const floater = new ActionFloatingSystem(sprites);
    const lemming = new Lemming(20, 12, 0);

    expect(climber.triggerLemAction(lemming)).toBe(true);
    expect(climber.triggerLemAction(lemming)).toBe(false);
    expect(lemming.canClimb).toBe(true);
    expect(floater.triggerLemAction(lemming)).toBe(true);
    expect(floater.triggerLemAction(lemming)).toBe(false);
    expect(lemming.hasParachute).toBe(true);
  });

  it('runs an eighty-tick bomber countdown exactly once', () => {
    const level = buildSyntheticLevel();
    const countdown = new ActionCountdownSystem(createFilledMaskProvider());
    const lemming = new Lemming(20, 12, 0);

    expect(countdown.triggerLemAction(lemming)).toBe(true);
    expect(countdown.triggerLemAction(lemming)).toBe(false);
    for (let tick = 0; tick < 79; tick++) {
      expect(countdown.process(level, lemming)).toBe(LemmingStateType.NO_STATE_TYPE);
    }
    expect(countdown.process(level, lemming)).toBe(LemmingStateType.OHNO);
    expect(lemming.countdown).toBe(0);
    expect(lemming.countdownAction).toBeNull();
  });
});

describe('constructive and destructive skills', () => {
  it('builder lays a six-pixel step on its placement frame', () => {
    const level = buildSyntheticLevel();
    const builder = new ActionBuildSystem(createStubSprites());
    const lemming = new Lemming(20, 12, 0);

    expect(builder.triggerLemAction(lemming)).toBe(true);
    lemming.frameIndex = 8;
    expect(builder.process(level, lemming)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(Array.from({ length: 6 }, (_, offset) => level.hasGroundAt(20 + offset, 11)))
      .toEqual([true, true, true, true, true, true]);
  });

  it('digger clears three rows and falls when it reaches empty terrain', () => {
    const level = buildSyntheticLevel();
    fillGround(level, 16, 10, 24, 12);
    const digger = new ActionDiggSystem(createStubSprites());
    const lemming = new Lemming(20, 12, 0);

    expect(digger.triggerLemAction(lemming)).toBe(true);
    expect(digger.process(level, lemming)).toBe(LemmingStateType.NO_STATE_TYPE);
    for (let y = 10; y <= 12; y++) {
      for (let x = 16; x <= 24; x++) {
        expect(level.hasGroundAt(x, y)).toBe(false);
      }
    }
    lemming.frameIndex = 7;
    expect(digger.process(level, lemming)).toBe(LemmingStateType.FALLING);
  });

  it('basher applies the directional mask immediately before its movement phase', () => {
    const level = buildSyntheticLevel();
    fillGround(level, 12, 2, 27, 20);
    const basher = new ActionBashSystem(createStubSprites(), createFilledMaskProvider());
    const lemming = new Lemming(20, 12, 0);
    lemming.frameIndex = 1;

    expect(level.hasGroundAt(12, 2)).toBe(true);
    expect(basher.triggerLemAction(lemming)).toBe(true);
    lemming.frameIndex = 1;
    expect(basher.process(level, lemming)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(level.hasGroundAt(12, 2)).toBe(false);
    expect(level.hasGroundAt(27, 11)).toBe(false);
    expect(level.hasGroundAt(20, 12)).toBe(true);
  });

  it('miner applies its first mask and falls once forward ground is absent', () => {
    const level = buildSyntheticLevel();
    fillGround(level, 12, 0, 27, 12);
    const miner = new ActionMineSystem(createStubSprites(), createFilledMaskProvider());
    const lemming = new Lemming(20, 12, 0);

    expect(miner.triggerLemAction(lemming)).toBe(true);
    expect(miner.process(level, lemming)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(level.hasGroundAt(12, 0)).toBe(false);
    expect(level.hasGroundAt(27, 12)).toBe(false);

    lemming.frameIndex = 2;
    expect(miner.process(level, lemming)).toBe(LemmingStateType.FALLING);
  });
});

describe('movement and terminal actions', () => {
  it('walks on a floor, falls through a gap, floats, lands, and splats after a long fall', () => {
    const sprites = createStubSprites();
    const level = buildSyntheticLevel();
    const walker = new ActionWalkSystem(sprites);
    const faller = new ActionFallSystem(sprites);
    const lemming = new Lemming(20, 12, 0);
    fillGround(level, 0, 12, 63, 12);

    expect(walker.process(level, lemming)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(lemming.x).toBe(21);

    level.clearGroundAt(22, 12);
    level.clearGroundAt(22, 13);
    level.clearGroundAt(22, 14);
    expect(walker.process(level, lemming)).toBe(LemmingStateType.FALLING);

    lemming.y = 9;
    level.setGroundAt(lemming.x, 11, 7);
    expect(faller.process(level, lemming)).toBe(LemmingStateType.WALKING);
    expect(lemming.y).toBe(11);

    lemming.y = 11;
    lemming.state = Lemming.LEM_MAX_FALLING + 1;
    expect(faller.process(level, lemming)).toBe(LemmingStateType.SPLATTING);

    lemming.y = 5;
    lemming.state = 17;
    lemming.hasParachute = true;
    expect(faller.process(level, lemming)).toBe(LemmingStateType.FLOATING);
  });

  it('removes drowned and splatted lemmings at their final animation frame', () => {
    const level = buildSyntheticLevel();
    const sprites = createStubSprites();
    const drowning = new ActionDrowningSystem(sprites);
    const splatting = new ActionSplatterSystem(sprites);
    const lemming = new Lemming(20, 12, 0);

    lemming.frameIndex = 15;
    expect(drowning.process(level, lemming)).toBe(LemmingStateType.OUT_OFF_LEVEL);
    lemming.frameIndex = 15;
    expect(splatting.process(level, lemming)).toBe(LemmingStateType.OUT_OFF_LEVEL);
    expect(lemming.isDisabled()).toBe(true);
  });

  it('adds one survivor when the exit animation completes', () => {
    const level = buildSyntheticLevel({ releaseCount: 1, needCount: 1 });
    const victory = new GameVictoryCondition(level);
    victory.releaseOne();
    const exiting = new ActionExitingSystem(createStubSprites(), victory);
    const lemming = new Lemming(20, 12, 0);
    lemming.frameIndex = 7;

    expect(exiting.process(level, lemming)).toBe(LemmingStateType.OUT_OFF_LEVEL);
    expect(victory.getSurvivorsCount()).toBe(1);
    expect(lemming.isDisabled()).toBe(true);
  });
});

describe('masks and blocker triggers', () => {
  it('reports the real number of frames in a mask list', () => {
    const mask = new Mask(1, 1, 0, 0, new Int8Array([1]));
    expect(new MaskList([mask, mask]).length).toBe(2);
    expect(createFilledMaskProvider().GetMask(MaskTypes.NUMBERS).length).toBe(10);
  });

  it('installs blocker directions and removes them when support disappears', () => {
    const level = buildSyntheticLevel();
    const timer = new GameTimer(level);
    const triggers = new TriggerManager(timer);
    const blocker = new ActionBlockerSystem(createStubSprites(), triggers);
    const lemming = new Lemming(20, 12, 0);
    level.setGroundAt(20, 13, 7);

    expect(blocker.triggerLemAction(lemming)).toBe(true);
    expect(blocker.process(level, lemming)).toBe(LemmingStateType.NO_STATE_TYPE);
    expect(triggers.trigger(16, 12)).toBe(TriggerTypes.BLOCKER_LEFT);
    expect(triggers.trigger(25, 12)).toBe(TriggerTypes.BLOCKER_RIGHT);

    level.clearGroundAt(20, 13);
    expect(blocker.process(level, lemming)).toBe(LemmingStateType.FALLING);
    expect(triggers.trigger(16, 12)).toBe(TriggerTypes.NO_TRIGGER);
  });

  it('does not remove a real trigger when asked to remove an unknown one', () => {
    const level = buildSyntheticLevel();
    const manager = new TriggerManager(new GameTimer(level));
    const real = new Trigger(TriggerTypes.EXIT_LEVEL, 1, 1, 2, 2);
    const unknown = new Trigger(TriggerTypes.DROWN, 10, 10, 11, 11);
    manager.add(real);
    manager.remove(unknown);

    expect(manager.trigger(1, 1)).toBe(TriggerTypes.EXIT_LEVEL);
  });
});
