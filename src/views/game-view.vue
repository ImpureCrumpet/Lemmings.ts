<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import { GameFactory } from '@/game/game-factory';
import type { Game } from '@/game/game';
import type { GameResources } from '@/game/game-resources';
import type { GameResult } from '@/game/game-result';
import { GameStateTypeHelper, GameStateTypes } from '@/game/game-state-types';
import { GameTypes, GameTypesHelper } from '@/game/game-types';
import type { AudioPlayer, AudioPlayerState } from '@/game/resources/sound/audio-player';
import type { Level } from '@/game/resources/level';
import { LogHandler } from '@/game/utilities/log-handler';
import { Stage } from '@/game/view/stage';
import {
  GAME_SKILL_CONTROLS,
  type GameControlAction,
  type ViewControlAction,
} from '@/game/controls/game-control-actions';
import { KeyboardControlManager } from '@/game/controls/keyboard-controls';

const route = useRoute();
const log = new LogHandler('GameView');
const gameFactory = new GameFactory(`${import.meta.env.BASE_URL}data`);

const gameCanvas = ref<HTMLCanvasElement>();
const levelIndex = ref(0);
const levelGroupIndex = ref(0);
const gameType = ref(GameTypes.UNKNOWN);
const musicIndex = ref(0);
const soundIndex = ref(0);
const gameState = ref('');
const gameSpeedFactor = ref(1);
const loadError = ref('');
const audioStatus = ref('Audio starts after you press a Play button.');
const controlAnnouncement = ref('Keyboard controls are available. Press 1 through 8 to select a skill.');
const selectedSkill = ref(0);
const skillCounts = ref(GAME_SKILL_CONTROLS.map(() => 0));
const releaseRate = ref(0);
const minimumReleaseRate = ref(0);
const timeLeft = ref('0-00');
const outCount = ref(0);
const survivorCount = ref(0);
const survivorPercentage = ref(0);
const focusedLemmingDescription = ref('No lemming selected');
const nukeConfirmationPending = ref(false);
const nuking = ref(false);
const gameRunning = ref(false);

const gameResources = shallowRef<GameResources>();
const musicPlayer = shallowRef<AudioPlayer>();
const soundPlayer = shallowRef<AudioPlayer>();
const game = shallowRef<Game>();
const stage = shallowRef<Stage>();
const level = shallowRef<Level>();

let gameEndTimeout: number | undefined;
let musicRequest = 0;
let soundRequest = 0;
let keyboardControls: KeyboardControlManager | undefined;
let observedGame: Game | undefined;
let nukeConfirmationTimeout: number | undefined;

const selectedSkillName = computed(() => (
  GAME_SKILL_CONTROLS.find((control) => control.skill === selectedSkill.value)?.name
  ?? 'None'
));

const gameStatusText = computed(() => [
  gameRunning.value ? 'Playing' : 'Paused',
  `time ${timeLeft.value}`,
  `${outCount.value} out`,
  `${survivorCount.value} rescued (${survivorPercentage.value}%)`,
  `${selectedSkillName.value} selected`,
].join(' · '));

const canApplySelectedSkill = computed(() => {
  const selectedIndex = GAME_SKILL_CONTROLS.findIndex(
    (control) => control.skill === selectedSkill.value,
  );
  return focusedLemmingDescription.value !== 'No lemming selected'
    && selectedIndex >= 0
    && skillCounts.value[selectedIndex] > 0;
});

type StartOutcome = 'started' | 'resumed' | 'failed';

function syncControlState(): void {
  const currentGame = game.value;
  if (!currentGame) {
    selectedSkill.value = 0;
    skillCounts.value = GAME_SKILL_CONTROLS.map(() => 0);
    releaseRate.value = 0;
    minimumReleaseRate.value = 0;
    timeLeft.value = '0-00';
    outCount.value = 0;
    survivorCount.value = 0;
    survivorPercentage.value = 0;
    focusedLemmingDescription.value = 'No lemming selected';
    nukeConfirmationPending.value = false;
    nuking.value = false;
    gameRunning.value = false;
    return;
  }

  const skills = currentGame.getGameSkills();
  const victory = currentGame.getVictoryCondition();
  const timer = currentGame.getGameTimer();
  const focusedId = currentGame.getFocusedLemmingId();
  const focusedLemming = focusedId === undefined
    ? undefined
    : currentGame.getLemmingManager().getLemming(focusedId);

  selectedSkill.value = skills.getSelectedSkill();
  skillCounts.value = GAME_SKILL_CONTROLS.map((control) => skills.getSkill(control.skill));
  releaseRate.value = victory.getCurrentReleaseRate();
  minimumReleaseRate.value = victory.getMinReleaseRate();
  timeLeft.value = timer.getGameLeftTimeString();
  outCount.value = victory.getOutCount();
  survivorCount.value = victory.getSurvivorsCount();
  survivorPercentage.value = victory.getSurvivorPercentage();
  gameRunning.value = timer.isRunning();
  nukeConfirmationPending.value = currentGame.isNukeConfirmationPending();
  nuking.value = currentGame.getLemmingManager().isNuking();
  focusedLemmingDescription.value = focusedLemming
    ? `Lemming ${focusedLemming.id + 1}, ${focusedLemming.action?.getActionName() ?? 'inactive'}, position ${focusedLemming.x}, ${focusedLemming.y}`
    : 'No lemming selected';
}

function clearNukeConfirmationTimer(): void {
  if (nukeConfirmationTimeout !== undefined) {
    window.clearTimeout(nukeConfirmationTimeout);
    nukeConfirmationTimeout = undefined;
  }
}

function onControlAction(action?: GameControlAction): void {
  if (!action) {
    return;
  }

  syncControlState();
  const skillControl = GAME_SKILL_CONTROLS.find((control) => control.action === action);
  if (skillControl) {
    controlAnnouncement.value = `${skillControl.name} selected. ${skillCounts.value[skillControl.skill - 1]} available.`;
    return;
  }

  switch (action) {
    case 'toggle-pause':
      controlAnnouncement.value = gameRunning.value ? 'Game resumed.' : 'Game paused.';
      break;
    case 'focus-previous-lemming':
    case 'focus-next-lemming':
      controlAnnouncement.value = focusedLemmingDescription.value;
      break;
    case 'apply-selected-skill':
      controlAnnouncement.value = `${selectedSkillName.value} assigned to ${focusedLemmingDescription.value}.`;
      break;
    case 'nuke':
      clearNukeConfirmationTimer();
      if (nukeConfirmationPending.value) {
        controlAnnouncement.value = 'Nuke armed. Activate Nuke again within four seconds to confirm.';
        nukeConfirmationTimeout = window.setTimeout(() => {
          game.value?.cancelNukeConfirmation();
          syncControlState();
          controlAnnouncement.value = 'Nuke cancelled.';
        }, 4_000);
      } else {
        controlAnnouncement.value = 'Nuke confirmed.';
      }
      break;
    case 'cancel-nuke':
      clearNukeConfirmationTimer();
      controlAnnouncement.value = 'Nuke cancelled.';
      break;
  }
}

function detachControlState(): void {
  if (!observedGame) {
    return;
  }
  observedGame.onControlAction.off(onControlAction);
  observedGame.getGameTimer().onGameTick.off(syncControlState);
  observedGame.getGameSkills().onCountChanged.off(syncControlState);
  observedGame.getGameSkills().onSelectionChanged.off(syncControlState);
  observedGame = undefined;
}

function attachControlState(nextGame: Game): void {
  detachControlState();
  observedGame = nextGame;
  nextGame.onControlAction.on(onControlAction);
  nextGame.getGameTimer().onGameTick.on(syncControlState);
  nextGame.getGameSkills().onCountChanged.on(syncControlState);
  nextGame.getGameSkills().onSelectionChanged.on(syncControlState);
  syncControlState();
}

function cycleGameSpeed(): void {
  const speeds = [1, 2, 4];
  const currentIndex = speeds.indexOf(gameSpeedFactor.value);
  gameSpeedFactor.value = speeds[(currentIndex + 1) % speeds.length];
  if (game.value) {
    game.value.getGameTimer().speedFactor = gameSpeedFactor.value;
  }
  controlAnnouncement.value = `Game speed ${gameSpeedFactor.value} times.`;
  syncControlState();
}

function performViewControlAction(action: ViewControlAction): void {
  switch (action) {
    case 'start':
      void start().then((outcome) => {
        if (outcome === 'started') {
          controlAnnouncement.value = 'Game started.';
        } else if (outcome === 'resumed') {
          controlAnnouncement.value = 'Game resumed.';
        }
      });
      return;
    case 'previous-level':
      void moveToLevel(-1);
      return;
    case 'next-level':
      void moveToLevel(1);
      return;
    case 'cycle-speed':
      cycleGameSpeed();
      return;
    default:
      game.value?.performControlAction(action);
  }
}

function describeAudioState(label: string, player: AudioPlayer, state: AudioPlayerState): string {
  if (state === 'unavailable') {
    return `${label} unavailable: ${player.errorMessage || 'this browser could not start audio'}`;
  }
  const descriptions: Record<Exclude<AudioPlayerState, 'unavailable'>, string> = {
    idle: 'ready',
    loading: 'starting…',
    playing: 'playing',
    paused: 'paused',
    stopped: 'stopped',
  };
  return `${label} ${descriptions[state]}`;
}

function watchAudioState(label: string, player: AudioPlayer): void {
  player.onStateChanged.on((state) => {
    if (state) {
      audioStatus.value = describeAudioState(label, player, state);
    }
  });
}

function syncGameVisibility(): void {
  game.value?.getGameTimer().setPageVisible(document.visibilityState !== 'hidden');
}

function reportLoadError(error: unknown): void {
  loadError.value = error instanceof Error
    ? error.message
    : 'Unable to load the original game data.';
}

async function start(replayString?: string): Promise<StartOutcome> {
  if (game.value) {
    game.value.getGameTimer().resume();
    syncControlState();
    return 'resumed';
  }

  loadError.value = '';
  let nextGame: Game | undefined;
  try {
    nextGame = await gameFactory.getGame(
      gameType.value,
      levelGroupIndex.value,
      levelIndex.value,
    );
  } catch (error) {
    reportLoadError(error);
    return 'failed';
  }
  if (!nextGame) {
    log.log('Unable to create game!');
    loadError.value = 'Unable to create the game for this level.';
    return 'failed';
  }

  level.value = nextGame.level;

  if (replayString) {
    nextGame.getCommandManager().loadReplay(replayString);
  }

  if (stage.value) {
    nextGame.setGameDisplay(stage.value.getGameDisplay());
    nextGame.setGuiDisplay(stage.value.getGuiDisplay());
  }

  nextGame.getGameTimer().speedFactor = gameSpeedFactor.value;
  nextGame.getGameTimer().setPageVisible(document.visibilityState !== 'hidden');
  nextGame.onGameEnd.on(onGameEnd);
  gameState.value = GameStateTypeHelper.toString(GameStateTypes.RUNNING);
  game.value = nextGame;
  attachControlState(nextGame);
  nextGame.start();
  syncControlState();
  return 'started';
}

function onGameEnd(result?: GameResult): void {
  if (!result) {
    return;
  }

  gameState.value = GameStateTypeHelper.toString(result.state);
  syncControlState();
  stage.value?.startFadeOut();

  gameEndTimeout = window.setTimeout(() => {
    void moveToLevel(result.state === GameStateTypes.SUCCEEDED ? 1 : 0);
  }, 2500);
}

function stopMusic(): void {
  musicRequest++;
  musicPlayer.value?.stop();
  musicPlayer.value = undefined;
}

async function playMusic(moveInterval = 0): Promise<void> {
  stopMusic();
  if (!gameResources.value) {
    return;
  }

  const request = musicRequest;
  musicIndex.value = Math.max(0, musicIndex.value + moveInterval);
  const player = gameResources.value.getMusicPlayer(musicIndex.value);
  if (request !== musicRequest) {
    player.stop();
    return;
  }
  musicPlayer.value = player;
  watchAudioState('Music', player);
  await player.play();
}

function stopSound(): void {
  soundRequest++;
  soundPlayer.value?.stop();
  soundPlayer.value = undefined;
}

async function playSound(moveInterval = 0): Promise<void> {
  stopSound();
  if (!gameResources.value) {
    return;
  }

  const request = soundRequest;
  soundIndex.value = Math.max(0, soundIndex.value + moveInterval);
  const player = gameResources.value.getSoundPlayer(soundIndex.value);
  if (request !== soundRequest) {
    player.stop();
    return;
  }
  soundPlayer.value = player;
  watchAudioState('Sound', player);
  await player.play();
}

async function exportToolbarPng(): Promise<void> {
  if (!gameResources.value || !level.value) {
    return;
  }

  const sprites = await gameResources.value.getSkillPanelSprite(level.value.colorPalette);
  const panel = sprites.getPanelSprite();
  const exportScale = panel.width === 320 ? 2 : 1;

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = panel.width;
  sourceCanvas.height = panel.height;

  const sourceContext = sourceCanvas.getContext('2d');
  if (!sourceContext) {
    return;
  }

  sourceContext.putImageData(
    new ImageData(panel.getData(), panel.width, panel.height),
    0,
    0,
  );

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = panel.width * exportScale;
  exportCanvas.height = panel.height * exportScale;

  const exportContext = exportCanvas.getContext('2d');
  if (!exportContext) {
    return;
  }

  exportContext.imageSmoothingEnabled = false;
  exportContext.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);

  const downloadLink = document.createElement('a');
  downloadLink.download = 'toolbar.png';
  downloadLink.href = exportCanvas.toDataURL('image/png');
  downloadLink.click();
}

async function moveToLevel(moveInterval = 0): Promise<void> {
  loadError.value = '';
  try {
    levelIndex.value += Math.trunc(moveInterval);

    const config = await gameFactory.getConfig(gameType.value);
    if (!config) {
      return;
    }

    if (levelIndex.value < 0) {
      if (levelGroupIndex.value > 0) {
        levelGroupIndex.value -= 1;
        levelIndex.value = config.level.getGroupLength(levelGroupIndex.value) - 1;
      } else {
        levelIndex.value = 0;
      }
    }

    if (levelIndex.value >= config.level.getGroupLength(levelGroupIndex.value)) {
      if (levelGroupIndex.value < config.level.order.length - 1) {
        levelGroupIndex.value += 1;
        levelIndex.value = 0;
      } else {
        levelIndex.value = config.level.getGroupLength(levelGroupIndex.value) - 1;
      }
    }

    await loadLevel();
  } catch (error) {
    reportLoadError(error);
  }
}

async function selectGameType(selectedGameType: GameTypes): Promise<void> {
  loadError.value = '';
  const resources = await gameFactory.getGameResources(selectedGameType);
  if (!resources) {
    log.log('Unable to get game resources');
    return;
  }

  gameResources.value = resources;
  levelGroupIndex.value = 0;

  try {
    await loadLevel();
  } catch (error) {
    reportLoadError(error);
  }
}

async function loadLevel(): Promise<void> {
  if (!gameResources.value) {
    return;
  }

  clearNukeConfirmationTimer();
  detachControlState();
  game.value?.stop();
  game.value = undefined;
  syncControlState();
  gameState.value = GameStateTypeHelper.toString(GameStateTypes.UNKNOWN);

  const nextLevel = await gameResources.value.getLevel(
    levelGroupIndex.value,
    levelIndex.value,
  );
  if (!nextLevel) {
    return;
  }

  level.value = nextLevel;
  if (!stage.value) {
    return;
  }

  const gameDisplay = stage.value.getGameDisplay();
  gameDisplay.clear();
  stage.value.resetFade();
  nextLevel.render(gameDisplay);
  gameDisplay.setScreenPosition(nextLevel.screenPositionX, 0);
  gameDisplay.redraw();
}

onMounted(() => {
  document.addEventListener('visibilitychange', syncGameVisibility);

  if (!gameCanvas.value) {
    return;
  }

  // The DOS toolbar is 320x40. At 2.5x it fills the canvas's 800x100
  // toolbar region, making the skill icons easier to read without changing
  // the game's logical resolution or input grid.
  stage.value = new Stage(gameCanvas.value, 2, 2.5);
  keyboardControls = new KeyboardControlManager(document, performViewControlAction);
  const routeGameType = Array.isArray(route.params.gameType)
    ? route.params.gameType[0]
    : route.params.gameType;
  const parsedGameType = Number.parseInt(routeGameType ?? '', 10);
  gameType.value = GameTypesHelper.isValid(parsedGameType)
    ? parsedGameType
    : GameTypes.LEMMINGS;

  log.log(
    `selected level: ${GameTypesHelper.toString(gameType.value)} : ${levelIndex.value} / ${levelGroupIndex.value}`,
  );
  void selectGameType(gameType.value);
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', syncGameVisibility);
  keyboardControls?.dispose();
  keyboardControls = undefined;
  detachControlState();
  clearNukeConfirmationTimer();

  if (gameEndTimeout !== undefined) {
    window.clearTimeout(gameEndTimeout);
  }
  game.value?.stop();
  stage.value?.dispose();
  stopMusic();
  stopSound();
});
</script>

<template>
  <main class="main">
    <p
      v-if="loadError"
      class="loadError"
      role="alert"
    >
      {{ loadError }} Copy your original Lemmings data files into the matching public/data folder.
    </p>

    <canvas
      ref="gameCanvas"
      height="480"
      width="800"
      class="gameCanvas"
      tabindex="0"
      aria-label="Lemmings game area. Drag to move the map, or tap a lemming to assign the selected skill. Keyboard controls are below."
    >
      Sorry! Your browser does not support HTML Canvas and cannot run this game.
    </canvas>

    <div
      v-if="level"
      class="levelName"
    >
      {{ level.name }}
    </div>

    <section
      v-if="game"
      class="accessibleToolbar"
      aria-labelledby="game-controls-heading"
    >
      <h2 id="game-controls-heading">
        Game controls
      </h2>

      <p
        class="gameStatus"
        aria-label="Current game status"
      >
        {{ gameStatusText }}
      </p>

      <div
        class="controlGroup releaseControls"
        role="group"
        aria-label="Release rate"
      >
        <button
          type="button"
          aria-label="Decrease release rate, keyboard minus"
          :disabled="!game || releaseRate <= minimumReleaseRate"
          @click="performViewControlAction('release-rate-decrease')"
        >
          − Rate
        </button>
        <output
          aria-label="Current release rate"
          aria-live="off"
        >
          {{ releaseRate }}
        </output>
        <button
          type="button"
          aria-label="Increase release rate, keyboard plus"
          :disabled="!game || releaseRate >= 99"
          @click="performViewControlAction('release-rate-increase')"
        >
          + Rate
        </button>
      </div>

      <div
        class="skillControls"
        role="group"
        aria-label="Lemming skills"
      >
        <button
          v-for="(control, index) in GAME_SKILL_CONTROLS"
          :key="control.action"
          type="button"
          class="skillButton"
          :class="{ selected: selectedSkill === control.skill }"
          :aria-label="`${control.name}, ${skillCounts[index]} available, keyboard ${control.shortcut}`"
          :aria-pressed="selectedSkill === control.skill"
          :disabled="!game || skillCounts[index] <= 0"
          @click="performViewControlAction(control.action)"
        >
          <span>{{ control.shortcut }} · {{ control.name }}</span>
          <strong aria-hidden="true">{{ skillCounts[index] }}</strong>
        </button>
      </div>

      <div
        class="controlGroup"
        role="group"
        aria-label="Keyboard lemming selection"
      >
        <button
          type="button"
          :disabled="!game || outCount <= 0"
          aria-label="Select previous lemming, keyboard left arrow"
          @click="performViewControlAction('focus-previous-lemming')"
        >
          ← Lemming
        </button>
        <span class="focusedLemming">{{ focusedLemmingDescription }}</span>
        <button
          type="button"
          :disabled="!canApplySelectedSkill"
          :aria-label="`Apply ${selectedSkillName} to selected lemming, keyboard Enter`"
          @click="performViewControlAction('apply-selected-skill')"
        >
          Apply {{ selectedSkillName }}
        </button>
        <button
          type="button"
          :disabled="!game || outCount <= 0"
          aria-label="Select next lemming, keyboard right arrow"
          @click="performViewControlAction('focus-next-lemming')"
        >
          Lemming →
        </button>
      </div>

      <div
        class="controlGroup"
        role="group"
        aria-label="Game playback"
      >
        <button
          type="button"
          :disabled="!game"
          :aria-label="`${gameRunning ? 'Pause' : 'Resume'} game, keyboard P`"
          @click="performViewControlAction('toggle-pause')"
        >
          {{ gameRunning ? 'Pause' : 'Resume' }}
        </button>
        <button
          type="button"
          :disabled="!game"
          aria-label="Cycle game speed, keyboard X"
          @click="performViewControlAction('cycle-speed')"
        >
          Speed {{ gameSpeedFactor }}×
        </button>
        <button
          type="button"
          class="nukeButton"
          :class="{ armed: nukeConfirmationPending }"
          :disabled="!game || nuking"
          :aria-pressed="nukeConfirmationPending"
          :aria-label="nukeConfirmationPending ? 'Confirm nuke now' : 'Arm nuke, keyboard N twice to confirm'"
          @click="performViewControlAction('nuke')"
        >
          {{ nukeConfirmationPending ? 'Confirm Nuke' : nuking ? 'Nuking' : 'Nuke' }}
        </button>
      </div>

      <p class="controlHint">
        Keyboard: 1–8 skills · −/+ release rate · ←/→ choose a lemming · Enter apply · P pause · X speed · [/] level · N twice nuke · Esc cancel
      </p>
      <p
        class="visuallyHidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ controlAnnouncement }}
      </p>
    </section>

    <div
      v-if="level"
      class="controls"
    >
      <button
        type="button"
        title="Export a 640×80 editable PNG of the current toolbar"
        @click="exportToolbarPng"
      >
        Export toolbar PNG
      </button>
    </div>

    <div class="controls">
      <button
        type="button"
        aria-label="Previous level"
        @click="performViewControlAction('previous-level')"
      >
        ⇦
      </button>
      <button
        type="button"
        aria-label="Start or resume game, keyboard S"
        @click="performViewControlAction('start')"
      >
        {{ game ? 'Resume' : 'Start' }}
      </button>
      <button
        type="button"
        aria-label="Next level"
        @click="performViewControlAction('next-level')"
      >
        ⇨
      </button>
    </div>

    <div class="controls">
      <span>Music:</span>
      <button
        type="button"
        aria-label="Previous music track"
        @click="playMusic(-1)"
      >
        ⇦
      </button>
      <button
        type="button"
        @click="playMusic()"
      >
        Play {{ musicIndex }}
      </button>
      <button
        type="button"
        @click="stopMusic"
      >
        Stop
      </button>
      <button
        type="button"
        aria-label="Next music track"
        @click="playMusic(1)"
      >
        ⇨
      </button>
    </div>

    <div class="controls">
      <span>Sound:</span>
      <button
        type="button"
        aria-label="Previous sound"
        @click="playSound(-1)"
      >
        ⇦
      </button>
      <button
        type="button"
        @click="playSound()"
      >
        Play {{ soundIndex }}
      </button>
      <button
        type="button"
        aria-label="Next sound"
        @click="playSound(1)"
      >
        ⇨
      </button>
    </div>

    <p
      class="audioStatus"
      role="status"
      aria-live="polite"
    >
      {{ audioStatus }}
    </p>
  </main>
</template>

<style scoped>

  .main {
    min-height: 100vh;
    overflow: auto;
    background: #000;
    color: #fff;
  }

  .gameCanvas {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 0 auto;
    image-rendering: pixelated;
    touch-action: none;
  }

  .gameCanvas:focus-visible,
  button:focus-visible {
    outline: 3px solid #54e7ff;
    outline-offset: 3px;
  }

  button {
    min-width: 44px;
    min-height: 44px;
    padding: 0.55rem 0.75rem;
    border: 2px solid #888;
    border-radius: 0.3rem;
    background: #202020;
    color: #fff;
    font: inherit;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    border-color: #fff;
    background: #303030;
  }

  button:disabled {
    color: #999;
    border-color: #555;
    cursor: not-allowed;
  }

  .levelName,
  .controls {
    margin: 0.75rem;
  }

  .levelName {
    text-align: center;
  }

  .accessibleToolbar {
    max-width: 800px;
    margin: 0.75rem auto;
    padding: 0.75rem;
    box-sizing: border-box;
    border: 2px solid #555;
    background: #101010;
  }

  .accessibleToolbar h2 {
    margin: 0 0 0.5rem;
    font-size: 1.1rem;
    text-align: center;
  }

  .gameStatus,
  .controlHint {
    margin: 0.5rem 0;
    color: #ddd;
    text-align: center;
  }

  .controlGroup {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    margin-top: 0.65rem;
  }

  .releaseControls output {
    min-width: 3ch;
    font-size: 1.2rem;
    font-weight: 700;
    text-align: center;
  }

  .skillControls {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
    margin-top: 0.65rem;
  }

  .skillButton {
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    text-align: left;
  }

  .skillButton.selected {
    border-color: #fff200;
    background: #173b16;
    box-shadow: inset 0 0 0 2px #fff200;
  }

  .skillButton strong {
    color: #8dff85;
  }

  .focusedLemming {
    max-width: 18rem;
    color: #fff200;
    text-align: center;
  }

  .nukeButton {
    border-color: #d34d4d;
  }

  .nukeButton.armed {
    border-color: #fff;
    background: #9b1010;
    color: #fff;
  }

  .visuallyHidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .loadError {
    max-width: 40rem;
    margin: 1rem auto;
    padding: 0.75rem 1rem;
    background: #240000;
    color: #ffb3b3;
    border: 1px solid #b00020;
  }

  .audioStatus {
    margin: 0.75rem;
    color: #ccc;
    text-align: center;
  }

  .controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  @media (max-width: 560px) {
    .skillControls {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .accessibleToolbar {
      margin-inline: 0.35rem;
    }
  }

</style>
