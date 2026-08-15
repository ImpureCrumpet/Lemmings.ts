import type { ViewControlAction } from '@/game/controls/game-control-actions';
import {
  DEFAULT_KEYBOARD_BINDINGS,
  isBindableKeyboardCode,
  type KeyboardBindings,
} from '@/game/controls/keyboard-controls';

export const SETTINGS_STORAGE_KEY = 'lemmings.ts.settings';
export const PROGRESS_STORAGE_KEY = 'lemmings.ts.progress';
export const PLAYER_DATA_FORMAT = 'lemmings.ts.player-data';
export const SETTINGS_SCHEMA_VERSION = 2;
export const PROGRESS_SCHEMA_VERSION = 1;

export type ToolbarStyle = 'classic' | 'high-contrast';
export type GameSpeed = 1 | 2 | 4;

export interface PlayerSettings {
  version: typeof SETTINGS_SCHEMA_VERSION;
  musicVolume: number;
  effectsVolume: number;
  musicMuted: boolean;
  effectsMuted: boolean;
  gameSpeed: GameSpeed;
  toolbarStyle: ToolbarStyle;
  displaySmoothing: boolean;
  keyboardBindings: Record<string, ViewControlAction>;
}

export interface LevelLocation {
  editionId: string;
  groupIndex: number;
  levelIndex: number;
  levelId: string;
}

export interface LevelCompletion {
  levelId: string;
  bestSurvivors: number;
  bestSurvivorPercentage: number;
  bestDurationTicks: number;
}

export interface PlayerProgress {
  version: typeof PROGRESS_SCHEMA_VERSION;
  lastLocation?: LevelLocation;
  completedLevels: Record<string, LevelCompletion>;
}

export interface PlayerDataExport {
  format: typeof PLAYER_DATA_FORMAT;
  version: 1;
  settings: PlayerSettings;
  progress: PlayerProgress;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const validActions = new Set<ViewControlAction>(Object.values(DEFAULT_KEYBOARD_BINDINGS));
const validSpeeds = new Set<GameSpeed>([1, 2, 4]);
const validToolbarStyles = new Set<ToolbarStyle>(['classic', 'high-contrast']);

export function createDefaultSettings(): PlayerSettings {
  return {
    version: SETTINGS_SCHEMA_VERSION,
    musicVolume: 0.8,
    effectsVolume: 0.8,
    musicMuted: false,
    effectsMuted: false,
    gameSpeed: 1,
    toolbarStyle: 'classic',
    displaySmoothing: false,
    keyboardBindings: { ...DEFAULT_KEYBOARD_BINDINGS },
  };
}

export function createDefaultProgress(): PlayerProgress {
  return {
    version: PROGRESS_SCHEMA_VERSION,
    completedLevels: {},
  };
}

export function createLevelId(editionId: string, levelOrderId: number): string {
  return `${editionId.toLowerCase()}:${levelOrderId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isVolume(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function readBindings(value: unknown): Record<string, ViewControlAction> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const bindings: Record<string, ViewControlAction> = {};
  for (const [code, action] of Object.entries(value)) {
    if (!isBindableKeyboardCode(code)
        || typeof action !== 'string'
        || !validActions.has(action as ViewControlAction)) {
      return undefined;
    }
    bindings[code] = action as ViewControlAction;
  }
  if (Object.keys(bindings).length !== validActions.size
      || new Set(Object.values(bindings)).size !== validActions.size) {
    return undefined;
  }
  return bindings;
}

/** Migrate the only pre-release settings shape into the current schema. */
function migrateSettingsV1(value: Record<string, unknown>): PlayerSettings | undefined {
  if (!isVolume(value.musicVolume)
      || !isVolume(value.effectsVolume)
      || typeof value.muted !== 'boolean'
      || !validSpeeds.has(value.gameSpeed as GameSpeed)) {
    return undefined;
  }

  return {
    ...createDefaultSettings(),
    musicVolume: value.musicVolume,
    effectsVolume: value.effectsVolume,
    musicMuted: value.muted,
    effectsMuted: value.muted,
    gameSpeed: value.gameSpeed as GameSpeed,
  };
}

export function validateSettings(value: unknown): PlayerSettings | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (value.version === 1) {
    return migrateSettingsV1(value);
  }
  if (value.version !== SETTINGS_SCHEMA_VERSION
      || !isVolume(value.musicVolume)
      || !isVolume(value.effectsVolume)
      || typeof value.musicMuted !== 'boolean'
      || typeof value.effectsMuted !== 'boolean'
      || !validSpeeds.has(value.gameSpeed as GameSpeed)
      || !validToolbarStyles.has(value.toolbarStyle as ToolbarStyle)
      || typeof value.displaySmoothing !== 'boolean') {
    return undefined;
  }

  const keyboardBindings = readBindings(value.keyboardBindings);
  if (!keyboardBindings) {
    return undefined;
  }

  return {
    version: SETTINGS_SCHEMA_VERSION,
    musicVolume: value.musicVolume,
    effectsVolume: value.effectsVolume,
    musicMuted: value.musicMuted,
    effectsMuted: value.effectsMuted,
    gameSpeed: value.gameSpeed as GameSpeed,
    toolbarStyle: value.toolbarStyle as ToolbarStyle,
    displaySmoothing: value.displaySmoothing,
    keyboardBindings,
  };
}

function validateLocation(value: unknown): LevelLocation | undefined {
  if (!isRecord(value)
      || typeof value.editionId !== 'string'
      || value.editionId.length === 0
      || !isNonNegativeInteger(value.groupIndex)
      || !isNonNegativeInteger(value.levelIndex)
      || typeof value.levelId !== 'string'
      || !value.levelId.startsWith(`${value.editionId.toLowerCase()}:`)) {
    return undefined;
  }
  return {
    editionId: value.editionId,
    groupIndex: value.groupIndex,
    levelIndex: value.levelIndex,
    levelId: value.levelId,
  };
}

function validateCompletion(value: unknown, key: string): LevelCompletion | undefined {
  if (!isRecord(value)
      || value.levelId !== key
      || !isNonNegativeInteger(value.bestSurvivors)
      || !isFiniteNumber(value.bestSurvivorPercentage)
      || value.bestSurvivorPercentage < 0
      || value.bestSurvivorPercentage > 100
      || !isNonNegativeInteger(value.bestDurationTicks)) {
    return undefined;
  }
  return {
    levelId: key,
    bestSurvivors: value.bestSurvivors,
    bestSurvivorPercentage: value.bestSurvivorPercentage,
    bestDurationTicks: value.bestDurationTicks,
  };
}

export function validateProgress(value: unknown): PlayerProgress | undefined {
  if (!isRecord(value)
      || value.version !== PROGRESS_SCHEMA_VERSION
      || !isRecord(value.completedLevels)) {
    return undefined;
  }

  const completedLevels: Record<string, LevelCompletion> = {};
  for (const [key, completion] of Object.entries(value.completedLevels)) {
    const validCompletion = validateCompletion(completion, key);
    if (!validCompletion) {
      return undefined;
    }
    completedLevels[key] = validCompletion;
  }

  const lastLocation = value.lastLocation === undefined
    ? undefined
    : validateLocation(value.lastLocation);
  if (value.lastLocation !== undefined && !lastLocation) {
    return undefined;
  }

  return {
    version: PROGRESS_SCHEMA_VERSION,
    ...(lastLocation ? { lastLocation } : {}),
    completedLevels,
  };
}

function cloneSettings(settings: PlayerSettings): PlayerSettings {
  return { ...settings, keyboardBindings: { ...settings.keyboardBindings } };
}

function cloneProgress(progress: PlayerProgress): PlayerProgress {
  return {
    ...progress,
    ...(progress.lastLocation ? { lastLocation: { ...progress.lastLocation } } : {}),
    completedLevels: Object.fromEntries(
      Object.entries(progress.completedLevels).map(([key, value]) => [key, { ...value }]),
    ),
  };
}

function parseStoredValue<T>(raw: string | null, validate: (value: unknown) => T | undefined): T | undefined {
  if (raw === null) {
    return undefined;
  }
  try {
    return validate(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export class PlayerStorage {
  private settings = createDefaultSettings();
  private progress = createDefaultProgress();
  private settingsLoaded = false;
  private progressLoaded = false;

  public constructor(private readonly storage?: StorageLike) {}

  public loadSettings(): PlayerSettings {
    if (!this.settingsLoaded) {
      this.settings = parseStoredValue(
        this.safeRead(SETTINGS_STORAGE_KEY),
        validateSettings,
      ) ?? createDefaultSettings();
      this.settingsLoaded = true;
    }
    return cloneSettings(this.settings);
  }

  public saveSettings(settings: PlayerSettings): PlayerSettings {
    const validSettings = validateSettings(settings);
    if (!validSettings) {
      return this.loadSettings();
    }
    this.settings = validSettings;
    this.settingsLoaded = true;
    this.safeWrite(SETTINGS_STORAGE_KEY, JSON.stringify(validSettings));
    return cloneSettings(validSettings);
  }

  public loadProgress(): PlayerProgress {
    if (!this.progressLoaded) {
      this.progress = parseStoredValue(
        this.safeRead(PROGRESS_STORAGE_KEY),
        validateProgress,
      ) ?? createDefaultProgress();
      this.progressLoaded = true;
    }
    return cloneProgress(this.progress);
  }

  public saveProgress(progress: PlayerProgress): PlayerProgress {
    const validProgress = validateProgress(progress) ?? createDefaultProgress();
    this.progress = validProgress;
    this.progressLoaded = true;
    this.safeWrite(PROGRESS_STORAGE_KEY, JSON.stringify(validProgress));
    return cloneProgress(validProgress);
  }

  public setLastLocation(location: LevelLocation): PlayerProgress {
    const validLocation = validateLocation(location);
    if (!validLocation) {
      return this.loadProgress();
    }
    return this.saveProgress({
      ...this.loadProgress(),
      lastLocation: validLocation,
    });
  }

  public recordCompletion(
    location: LevelLocation,
    result: Pick<LevelCompletion, 'bestSurvivors' | 'bestSurvivorPercentage' | 'bestDurationTicks'>,
  ): PlayerProgress {
    const validLocation = validateLocation(location);
    if (!validLocation
        || !isNonNegativeInteger(result.bestSurvivors)
        || !isFiniteNumber(result.bestSurvivorPercentage)
        || result.bestSurvivorPercentage < 0
        || result.bestSurvivorPercentage > 100
        || !isNonNegativeInteger(result.bestDurationTicks)) {
      return this.loadProgress();
    }
    const progress = this.loadProgress();
    const previous = progress.completedLevels[validLocation.levelId];
    const completion: LevelCompletion = {
      levelId: validLocation.levelId,
      bestSurvivors: Math.max(previous?.bestSurvivors ?? 0, result.bestSurvivors),
      bestSurvivorPercentage: Math.max(
        previous?.bestSurvivorPercentage ?? 0,
        result.bestSurvivorPercentage,
      ),
      bestDurationTicks: previous && previous.bestDurationTicks > 0
        ? Math.min(previous.bestDurationTicks, result.bestDurationTicks)
        : result.bestDurationTicks,
    };
    return this.saveProgress({
      ...progress,
      lastLocation: { ...validLocation },
      completedLevels: {
        ...progress.completedLevels,
        [validLocation.levelId]: completion,
      },
    });
  }

  public resetAll(): void {
    this.settings = createDefaultSettings();
    this.progress = createDefaultProgress();
    this.settingsLoaded = true;
    this.progressLoaded = true;
    this.safeRemove(SETTINGS_STORAGE_KEY);
    this.safeRemove(PROGRESS_STORAGE_KEY);
  }

  public exportData(): string {
    const data: PlayerDataExport = {
      format: PLAYER_DATA_FORMAT,
      version: 1,
      settings: this.loadSettings(),
      progress: this.loadProgress(),
    };
    return JSON.stringify(data, null, 2);
  }

  public importData(raw: string): boolean {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return false;
    }
    if (!isRecord(value)
        || value.format !== PLAYER_DATA_FORMAT
        || value.version !== 1) {
      return false;
    }
    const settings = validateSettings(value.settings);
    const progress = validateProgress(value.progress);
    if (!settings || !progress) {
      return false;
    }
    this.saveSettings(settings);
    this.saveProgress(progress);
    return true;
  }

  private safeRead(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private safeWrite(key: string, value: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch {
      // The in-memory copy remains usable if storage is denied or full.
    }
  }

  private safeRemove(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {
      // Reset still applies to the in-memory copy when storage is unavailable.
    }
  }
}

export function createBrowserPlayerStorage(): PlayerStorage {
  try {
    return new PlayerStorage(typeof window === 'undefined' ? undefined : window.localStorage);
  } catch {
    return new PlayerStorage();
  }
}

export function mergeKeyboardBindings(
  bindings: KeyboardBindings,
  code: string,
  action: ViewControlAction,
): Record<string, ViewControlAction> {
  const previousCode = Object.entries(bindings)
    .find(([, boundAction]) => boundAction === action)?.[0];
  if (!previousCode || previousCode === code) {
    return { ...bindings };
  }

  const displacedAction = bindings[code];
  const updated: Record<string, ViewControlAction> = { ...bindings };
  delete updated[previousCode];
  if (displacedAction) {
    updated[previousCode] = displacedAction;
  }
  updated[code] = action;
  return updated;
}
