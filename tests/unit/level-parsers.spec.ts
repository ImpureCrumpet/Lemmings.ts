import { describe, expect, it } from 'vitest';
import { GameConfig } from '@/game/config/game-config';
import { SkillTypes } from '@/game/game-play/skill-types';
import { BinaryReader } from '@/game/resources/file/binary-reader';
import { LevelReader } from '@/game/resources/lemmings/level-reader';
import { OddTableReader } from '@/game/resources/lemmings/odd-table-reader';
import { LevelIndexResolve } from '@/game/resources/level-index-resolve';
import { buildLevelFixture, buildOddTableFixture } from '../fixtures/binary-fixtures';

describe('LevelReader', () => {
  it('decodes a minimal synthetic level without commercial data', () => {
    const fixture = buildLevelFixture({ name: 'A level made by tests', superLemming: true });
    const level = new LevelReader(new BinaryReader(fixture, null, null, 'synthetic-level.dat'));

    expect(level.levelProperties).toMatchObject({
      releaseRate: 50,
      releaseCount: 20,
      needCount: 10,
      timeLimit: 5,
    });
    expect(level.levelProperties.skills[SkillTypes.CLIMBER]).toBe(1);
    expect(level.levelProperties.skills[SkillTypes.DIGGER]).toBe(8);
    expect(level.levelProperties.levelName).toBe('A level made by tests           ');
    expect(level.screenPositionX).toBe(320);
    expect(level.graphicSet1).toBe(2);
    expect(level.isSuperLemming).toBe(true);
    expect(level.objects).toEqual([]);
    expect(level.terrains).toEqual([]);
    expect(level.steel).toEqual([]);
  });

  it('fails with the source filename when a level is truncated', () => {
    const truncated = buildLevelFixture().slice(0, 100);
    expect(() => new LevelReader(new BinaryReader(truncated, null, null, 'truncated-level.dat')))
      .toThrow(/Unexpected end of truncated-level\.dat/);
  });
});

describe('OddTableReader', () => {
  it('reads names sequentially and returns null for both out-of-range directions', () => {
    const table = new OddTableReader(
      new BinaryReader(buildOddTableFixture('Alternate conditions'), null, null, 'oddtable.dat'),
    );

    expect(table.getLevelProperties(0)).toMatchObject({
      releaseRate: 40,
      releaseCount: 25,
      needCount: 12,
      timeLimit: 6,
      levelName: 'Alternate conditions            ',
    });
    expect(table.getLevelProperties(-1)).toBeNull();
    expect(table.getLevelProperties(1)).toBeNull();
  });
});

describe('LevelIndexResolve', () => {
  it('resolves file parts, odd-table entries, and cumulative level numbers', () => {
    const config = new GameConfig();
    config.level.order = [[10, 11], [-123], [40, 41]];
    const resolver = new LevelIndexResolve(config);

    expect(resolver.resolve(1, 0)).toMatchObject({
      fileId: 12,
      partIndex: 3,
      useOddTable: true,
      levelNumber: 2,
    });
    expect(resolver.resolve(2, 1)?.levelNumber).toBe(4);
    expect(resolver.resolve(-1, 0)).toBeNull();
    expect(resolver.resolve(0, -1)).toBeNull();
    expect(resolver.resolve(3, 0)).toBeNull();
  });
});
