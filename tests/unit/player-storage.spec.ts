import { describe, expect, it } from 'vitest';
import {
  PLAYER_DATA_FORMAT,
  PROGRESS_STORAGE_KEY,
  SETTINGS_SCHEMA_VERSION,
  SETTINGS_STORAGE_KEY,
  PlayerStorage,
  createDefaultSettings,
  createLevelId,
  mergeKeyboardBindings,
  type StorageLike,
} from '@/game/persistence/player-storage';

class MemoryStorage implements StorageLike {
  public readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

const location = {
  editionId: 'lemmings',
  groupIndex: 1,
  levelIndex: 2,
  levelId: createLevelId('lemmings', -21),
};

describe('PlayerStorage settings', () => {
  it('supplies independent defaults and persists valid settings separately', () => {
    const backing = new MemoryStorage();
    const storage = new PlayerStorage(backing);
    const first = storage.loadSettings();
    first.musicVolume = 0.35;
    first.keyboardBindings = mergeKeyboardBindings(
      first.keyboardBindings,
      'KeyQ',
      'toggle-pause',
    );
    storage.saveSettings(first);

    expect(new PlayerStorage(backing).loadSettings()).toMatchObject({
      version: SETTINGS_SCHEMA_VERSION,
      musicVolume: 0.35,
      keyboardBindings: { KeyQ: 'toggle-pause' },
    });
    expect(backing.values.has(SETTINGS_STORAGE_KEY)).toBe(true);
    expect(backing.values.has(PROGRESS_STORAGE_KEY)).toBe(false);

    const clone = storage.loadSettings();
    clone.musicVolume = 1;
    expect(storage.loadSettings().musicVolume).toBe(0.35);
  });

  it('migrates version 1 settings and rejects unknown or corrupt schemas', () => {
    const migratedBacking = new MemoryStorage();
    migratedBacking.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
      version: 1,
      musicVolume: 0.25,
      effectsVolume: 0.5,
      muted: true,
      gameSpeed: 2,
    }));
    expect(new PlayerStorage(migratedBacking).loadSettings()).toMatchObject({
      version: 2,
      musicVolume: 0.25,
      effectsVolume: 0.5,
      musicMuted: true,
      effectsMuted: true,
      gameSpeed: 2,
    });

    for (const invalid of [
      '{broken',
      JSON.stringify({ version: 999 }),
      JSON.stringify({ ...createDefaultSettings(), musicVolume: 9 }),
      JSON.stringify({
        ...createDefaultSettings(),
        keyboardBindings: { Digit1: 'select-climber' },
      }),
    ]) {
      const backing = new MemoryStorage();
      backing.setItem(SETTINGS_STORAGE_KEY, invalid);
      expect(new PlayerStorage(backing).loadSettings()).toEqual(createDefaultSettings());
    }
  });

  it('continues in memory when browser storage is denied or full', () => {
    const denied: StorageLike = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('quota'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const storage = new PlayerStorage(denied);
    const settings = storage.loadSettings();
    settings.effectsMuted = true;
    storage.saveSettings(settings);

    expect(storage.loadSettings().effectsMuted).toBe(true);
    expect(() => storage.resetAll()).not.toThrow();
  });

  it('reassigns a free key without disturbing unrelated key bindings', () => {
    const settings = createDefaultSettings();
    const updated = mergeKeyboardBindings(settings.keyboardBindings, 'Space', 'toggle-pause');

    expect(updated.Space).toBe('toggle-pause');
    expect(updated.KeyP).toBeUndefined();
    expect(updated.Digit1).toBe('select-climber');
  });

  it('swaps occupied keys without losing actions or unrelated preferences', () => {
    const backing = new MemoryStorage();
    const storage = new PlayerStorage(backing);
    const settings = storage.loadSettings();
    settings.musicVolume = 0.35;
    settings.gameSpeed = 4;
    settings.keyboardBindings = mergeKeyboardBindings(
      settings.keyboardBindings,
      'Digit1',
      'toggle-pause',
    );

    const saved = storage.saveSettings(settings);

    expect(saved.musicVolume).toBe(0.35);
    expect(saved.gameSpeed).toBe(4);
    expect(saved.keyboardBindings.Digit1).toBe('toggle-pause');
    expect(saved.keyboardBindings.KeyP).toBe('select-climber');
    expect(new Set(Object.values(saved.keyboardBindings)).size)
      .toBe(Object.keys(createDefaultSettings().keyboardBindings).length);
  });

  it('keeps the last valid settings when a caller attempts an invalid save', () => {
    const storage = new PlayerStorage(new MemoryStorage());
    const settings = storage.loadSettings();
    settings.effectsVolume = 0.25;
    storage.saveSettings(settings);

    const invalid = storage.loadSettings();
    invalid.keyboardBindings = { Digit1: 'select-climber' };

    expect(storage.saveSettings(invalid).effectsVolume).toBe(0.25);
    expect(storage.loadSettings().keyboardBindings)
      .toEqual(createDefaultSettings().keyboardBindings);
  });
});

describe('PlayerStorage progress and portability', () => {
  it('records only better completion metrics and remembers a stable location', () => {
    const storage = new PlayerStorage(new MemoryStorage());
    storage.setLastLocation(location);
    storage.recordCompletion(location, {
      bestSurvivors: 10,
      bestSurvivorPercentage: 50,
      bestDurationTicks: 900,
    });
    const progress = storage.recordCompletion(location, {
      bestSurvivors: 8,
      bestSurvivorPercentage: 40,
      bestDurationTicks: 700,
    });

    expect(progress.lastLocation).toEqual(location);
    expect(progress.completedLevels[location.levelId]).toEqual({
      levelId: location.levelId,
      bestSurvivors: 10,
      bestSurvivorPercentage: 50,
      bestDurationTicks: 700,
    });
  });

  it('ignores invalid completion input without erasing existing progress', () => {
    const storage = new PlayerStorage(new MemoryStorage());
    storage.recordCompletion(location, {
      bestSurvivors: 10,
      bestSurvivorPercentage: 50,
      bestDurationTicks: 900,
    });
    const progress = storage.recordCompletion(location, {
      bestSurvivors: -1,
      bestSurvivorPercentage: 101,
      bestDurationTicks: -1,
    });

    expect(Object.keys(progress.completedLevels)).toEqual([location.levelId]);
  });

  it('falls back when progress is partial, mismatched, or from an unknown version', () => {
    for (const invalid of [
      { version: 1, completedLevels: [], lastLocation: location },
      { version: 1, completedLevels: {}, lastLocation: { ...location, levelId: 'wrong:1' } },
      { version: 99, completedLevels: {} },
    ]) {
      const backing = new MemoryStorage();
      backing.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(invalid));
      expect(new PlayerStorage(backing).loadProgress()).toEqual({
        version: 1,
        completedLevels: {},
      });
    }
  });

  it('exports and imports both records without accepting unrelated JSON', () => {
    const source = new PlayerStorage(new MemoryStorage());
    const settings = source.loadSettings();
    settings.toolbarStyle = 'high-contrast';
    source.saveSettings(settings);
    source.recordCompletion(location, {
      bestSurvivors: 12,
      bestSurvivorPercentage: 60,
      bestDurationTicks: 800,
    });

    const exported = source.exportData();
    expect(JSON.parse(exported).format).toBe(PLAYER_DATA_FORMAT);

    const destination = new PlayerStorage(new MemoryStorage());
    expect(destination.importData(exported)).toBe(true);
    expect(destination.loadSettings().toolbarStyle).toBe('high-contrast');
    expect(destination.loadProgress().completedLevels[location.levelId].bestSurvivors).toBe(12);
    expect(destination.importData('{"format":"something-else"}')).toBe(false);
  });

  it('reset removes only Lemmings.ts player records', () => {
    const backing = new MemoryStorage();
    backing.setItem('another.application', 'keep me');
    const storage = new PlayerStorage(backing);
    storage.saveSettings(createDefaultSettings());
    storage.setLastLocation(location);
    storage.resetAll();

    expect(backing.values.get('another.application')).toBe('keep me');
    expect(backing.values.has(SETTINGS_STORAGE_KEY)).toBe(false);
    expect(backing.values.has(PROGRESS_STORAGE_KEY)).toBe(false);
  });
});
