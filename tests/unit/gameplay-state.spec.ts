import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandNuke } from '@/game/game-play/commands/command-nuke';
import { GameSkills } from '@/game/game-play/game-skills';
import { GameTimer } from '@/game/game-play/game-timer';
import { GameVictoryCondition } from '@/game/game-play/game-victory-condition';
import { SkillTypes } from '@/game/game-play/skill-types';
import { GameStateTypes } from '@/game/game-state-types';
import { advanceTicks, buildSyntheticGame, buildSyntheticLevel } from '../fixtures/gameplay-fixtures';

afterEach(() => {
  vi.useRealTimers();
});

describe('GameTimer', () => {
  it('advances exact logical ticks without using wall-clock time', () => {
    const timer = new GameTimer(buildSyntheticLevel({ timeLimit: 1 }));
    const beforeTicks: Array<number | undefined> = [];
    const onTick = vi.fn();
    timer.onBeforeGameTick.on((tick) => beforeTicks.push(tick));
    timer.onGameTick.on(onTick);

    advanceTicks(timer, 3);

    expect(beforeTicks).toEqual([0, 1, 2]);
    expect(onTick).toHaveBeenCalledTimes(3);
    expect(timer.getGameTicks()).toBe(3);
    expect(timer.getGameLeftTimeString()).toBe('0-59');
  });

  it('rejects speed factors that cannot produce a valid timer interval', () => {
    const timer = new GameTimer(buildSyntheticLevel());
    expect(() => { timer.speedFactor = 0; }).toThrow(/greater than zero/);
    expect(() => { timer.speedFactor = Number.NaN; }).toThrow(/greater than zero/);
    expect(timer.speedFactor).toBe(1);
  });

  it('suspends, continues, and toggles without leaking an active interval', () => {
    vi.useFakeTimers();
    const timer = new GameTimer(buildSyntheticLevel());

    timer.continue();
    timer.continue();
    expect(timer.isRunning()).toBe(true);
    expect(vi.getTimerCount()).toBe(1);

    timer.toggle();
    expect(timer.isRunning()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    timer.toggle();
    expect(timer.isRunning()).toBe(true);
    timer.stop();
    expect(timer.isRunning()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('GameSkills', () => {
  it('uses independent counts, validates assignments, and emits selected skill', () => {
    const level = buildSyntheticLevel();
    const skills = new GameSkills(level);
    const selections: Array<SkillTypes | undefined> = [];
    skills.onSelectionChanged.on((skill) => selections.push(skill));

    expect(skills.decreaseSkill(SkillTypes.CLIMBER)).toBe(true);
    expect(skills.decreaseSkill(SkillTypes.CLIMBER)).toBe(false);
    expect(level.skills[SkillTypes.CLIMBER]).toBe(1);
    expect(skills.decreaseSkill(SkillTypes.UNKNOWN)).toBe(false);
    expect(skills.setSelectedSkill(SkillTypes.MINER)).toBe(true);
    expect(skills.setSelectedSkill(SkillTypes.MINER)).toBe(false);
    expect(skills.setSelectedSkill(SkillTypes.UNKNOWN)).toBe(false);
    expect(selections).toEqual([SkillTypes.MINER]);
  });

  it('applies the cheat only to real skill slots', () => {
    const skills = new GameSkills(buildSyntheticLevel());
    const changed: Array<SkillTypes | undefined> = [];
    skills.onCountChanged.on((skill) => changed.push(skill));

    skills.cheat();

    expect(skills.getSkill(SkillTypes.UNKNOWN)).toBe(0);
    expect(skills.getSkill(SkillTypes.DIGGER)).toBe(99);
    expect(changed).toEqual([
      SkillTypes.CLIMBER,
      SkillTypes.FLOATER,
      SkillTypes.BOMBER,
      SkillTypes.BLOCKER,
      SkillTypes.BUILDER,
      SkillTypes.BASHER,
      SkillTypes.MINER,
      SkillTypes.DIGGER,
    ]);
  });
});

describe('GameVictoryCondition', () => {
  it('tracks releases, losses, survivors, rate bounds, nuking, and finalization', () => {
    const victory = new GameVictoryCondition(buildSyntheticLevel({
      releaseRate: 40,
      releaseCount: 2,
      needCount: 1,
    }));

    expect(victory.changeReleaseRate(-10)).toBe(false);
    expect(victory.changeReleaseRate(100)).toBe(true);
    expect(victory.getCurrentReleaseRate()).toBe(99);

    victory.releaseOne();
    victory.releaseOne();
    victory.releaseOne();
    expect(victory.getLeftCount()).toBe(0);
    expect(victory.getOutCount()).toBe(2);

    victory.removeOne();
    victory.removeOne();
    victory.removeOne();
    expect(victory.getOutCount()).toBe(0);

    victory.addSurvivor();
    expect(victory.getSurvivorsCount()).toBe(1);
    expect(victory.getSurvivorPercentage()).toBe(50);

    victory.doFinalize();
    victory.addSurvivor();
    expect(victory.changeReleaseRate(-10)).toBe(false);
    expect(victory.getSurvivorsCount()).toBe(1);
  });

  it('stops pending releases when nuking starts', () => {
    const victory = new GameVictoryCondition(buildSyntheticLevel({ releaseCount: 5 }));
    victory.releaseOne();
    victory.doNuke();
    victory.releaseOne();

    expect(victory.getLeftCount()).toBe(0);
    expect(victory.getOutCount()).toBe(1);
  });
});

describe('terrain bounds', () => {
  it('does not mutate the image or mask for coordinates outside the level', () => {
    const level = buildSyntheticLevel({ width: 4, height: 3 });
    level.setGroundAt(-1, 0, 7);
    level.setGroundAt(4, 0, 7);
    level.setGroundAt(0, 3, 7);

    expect(level.hasGroundAt(-1, 0)).toBe(false);
    expect(level.hasGroundAt(4, 0)).toBe(false);
    expect(level.hasGroundAt(0, 3)).toBe(false);
    expect(level.hasGroundAt(0, 0)).toBe(false);

    level.setGroundAt(0, 0, 7);
    expect(level.hasGroundAt(0, 0)).toBe(true);
    level.clearGroundAt(0, 0);
    expect(level.hasGroundAt(0, 0)).toBe(false);
  });
});

describe('game-end states and nuke command', () => {
  it('reports success once the required lemmings have exited', () => {
    const game = buildSyntheticGame({ releaseCount: 1, needCount: 1 });
    const victory = game.getVictoryCondition();
    victory.releaseOne();
    victory.addSurvivor();
    victory.removeOne();

    expect(game.getGameState()).toBe(GameStateTypes.SUCCEEDED);
    game.stop();
  });

  it('distinguishes insufficient survivors from time expiry', () => {
    const failed = buildSyntheticGame({ releaseCount: 1, needCount: 1 });
    failed.getVictoryCondition().doNuke();
    expect(failed.getGameState()).toBe(GameStateTypes.FAILED_LESS_LEMMINGS);
    failed.stop();

    const expired = buildSyntheticGame({ releaseCount: 1, needCount: 1, timeLimit: 0 });
    expect(expired.getGameState()).toBe(GameStateTypes.FAILED_OUT_OF_TIME);
    expired.stop();
  });

  it('records one nuke command and rejects a duplicate', () => {
    const game = buildSyntheticGame({ releaseCount: 2 });
    const commands = game.getCommandManager();

    expect(commands.queueCommand(new CommandNuke())).toBe(true);
    expect(commands.queueCommand(new CommandNuke())).toBe(false);
    expect(game.getVictoryCondition().getLeftCount()).toBe(0);
    expect(commands.serialize()).toBe('0=n');
    game.stop();
  });
});
