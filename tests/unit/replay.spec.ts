import { describe, expect, it } from 'vitest';
import type { Game } from '@/game/game';
import { CommandManager } from '@/game/game-play/commands/command-manager';
import { GameSkills } from '@/game/game-play/game-skills';
import { GameTimer } from '@/game/game-play/game-timer';
import { GameVictoryCondition } from '@/game/game-play/game-victory-condition';
import { SkillTypes } from '@/game/game-play/skill-types';
import { DrawProperties } from '@/game/resources/draw-properties';
import { LevelElement } from '@/game/resources/lemmings/level-element';
import {
  advanceTicks,
  buildSyntheticGame,
  buildSyntheticLevel,
  fillGround,
} from '../fixtures/gameplay-fixtures';

interface ReplayHarness {
  manager: CommandManager;
  skills: GameSkills;
  timer: GameTimer;
  victory: GameVictoryCondition;
}

describe('replay determinism', () => {
  it('preserves tick zero and multiple commands on the same tick', () => {
    const harness = createReplayHarness();
    harness.manager.loadReplay('0=s2&0=i10&2=d5');

    advanceTicks(harness.timer, 3);

    expect(harness.skills.getSelectedSkill()).toBe(SkillTypes.FLOATER);
    expect(harness.victory.getCurrentReleaseRate()).toBe(55);
    expect(harness.manager.serialize()).toBe('0=s2&0=i10&2=d5');
  });

  it('round-trips a canonical replay to the same tick-by-tick state hashes', () => {
    const replay = '0=s2&0=i10&2=d5&4=s7';
    const first = createReplayHarness();
    const second = createReplayHarness();
    first.manager.loadReplay(replay);
    second.manager.loadReplay(replay);

    const firstHashes: string[] = [];
    const secondHashes: string[] = [];
    for (let tick = 0; tick < 6; tick++) {
      first.timer.tick();
      second.timer.tick();
      firstHashes.push(stateHash(first));
      secondHashes.push(stateHash(second));
    }

    expect(secondHashes).toEqual(firstHashes);
    expect(first.manager.serialize()).toBe(replay);
    expect(second.manager.serialize()).toBe(replay);
  });

  it('ignores malformed replay entries without disturbing valid commands', () => {
    const harness = createReplayHarness();
    harness.manager.loadReplay('bad=s2&-1=s2&0=x1&0=snope&0=s&0=i&1=s8');

    advanceTicks(harness.timer, 2);

    expect(harness.skills.getSelectedSkill()).toBe(SkillTypes.DIGGER);
    expect(harness.manager.serialize()).toBe('1=s8');
  });

  it('replays a generated level to identical complete gameplay snapshots', () => {
    const first = createFullGameHarness();
    const second = createFullGameHarness();
    const replay = '0=s2&1=l0';
    first.getCommandManager().loadReplay(replay);
    second.getCommandManager().loadReplay(replay);

    const firstHashes: string[] = [];
    const secondHashes: string[] = [];
    for (let tick = 0; tick < 12; tick++) {
      first.getGameTimer().tick();
      second.getGameTimer().tick();
      firstHashes.push(fullGameStateHash(first));
      secondHashes.push(fullGameStateHash(second));
    }

    expect(secondHashes).toEqual(firstHashes);
    expect(first.getLemmingManager().getLemmings()).toHaveLength(1);
    expect(first.getLemmingManager().getLemming(0)?.hasParachute).toBe(true);
    expect(first.getGameSkills().getSkill(SkillTypes.FLOATER)).toBe(1);
    expect(first.getCommandManager().serialize()).toBe(replay);
    expect(second.getCommandManager().serialize()).toBe(replay);
    first.stop();
    second.stop();
  });
});

function createReplayHarness(): ReplayHarness {
  const level = buildSyntheticLevel();
  const timer = new GameTimer(level);
  const skills = new GameSkills(level);
  const victory = new GameVictoryCondition(level);
  const game = {
    getGameSkills: () => skills,
    getVictoryCondition: () => victory,
  } as unknown as Game;

  return {
    manager: new CommandManager(game, timer),
    skills,
    timer,
    victory,
  };
}

function stateHash(harness: ReplayHarness): string {
  return JSON.stringify({
    tick: harness.timer.getGameTicks(),
    releaseRate: harness.victory.getCurrentReleaseRate(),
    selectedSkill: harness.skills.getSelectedSkill(),
    skillCounts: Array.from(
      { length: SkillTypes.length() - 1 },
      (_, index) => harness.skills.getSkill((index + 1) as SkillTypes),
    ),
  });
}

function createFullGameHarness(): Game {
  const game = buildSyntheticGame({
    releaseRate: 99,
    releaseCount: 1,
    needCount: 1,
  });
  game.level.entrances = [new LevelElement(0, 0, 1, new DrawProperties(false, false, false, false))];
  fillGround(game.level, 0, 16, game.level.width - 1, 16);
  return game;
}

function fullGameStateHash(game: Game): string {
  return JSON.stringify({
    tick: game.getGameTimer().getGameTicks(),
    releaseRate: game.getVictoryCondition().getCurrentReleaseRate(),
    left: game.getVictoryCondition().getLeftCount(),
    out: game.getVictoryCondition().getOutCount(),
    survivors: game.getVictoryCondition().getSurvivorsCount(),
    selectedSkill: game.getGameSkills().getSelectedSkill(),
    skills: Array.from(
      { length: SkillTypes.length() - 1 },
      (_, index) => game.getGameSkills().getSkill((index + 1) as SkillTypes),
    ),
    lemmings: game.getLemmingManager().getLemmings().map((lemming) => ({
      id: lemming.id,
      x: lemming.x,
      y: lemming.y,
      state: lemming.state,
      frame: lemming.frameIndex,
      action: lemming.action?.getActionName() ?? null,
      climbing: lemming.canClimb,
      floating: lemming.hasParachute,
      countdown: lemming.countdown,
      removed: lemming.isRemoved(),
    })),
  });
}
