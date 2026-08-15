<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import { GameFactory } from '@/game/game-factory';
import type { Game } from '@/game/game';
import type { GameResources } from '@/game/game-resources';
import type { GameResult } from '@/game/game-result';
import { GameStateTypeHelper, GameStateTypes } from '@/game/game-state-types';
import { GameTypes, GameTypesHelper } from '@/game/game-types';
import type { AudioPlayer } from '@/game/resources/sound/audio-player';
import type { Level } from '@/game/resources/level';
import { LogHandler } from '@/game/utilities/log-handler';
import { Stage } from '@/game/view/stage';

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

const gameResources = shallowRef<GameResources>();
const musicPlayer = shallowRef<AudioPlayer>();
const soundPlayer = shallowRef<AudioPlayer>();
const game = shallowRef<Game>();
const stage = shallowRef<Stage>();
const level = shallowRef<Level>();

let gameEndTimeout: number | undefined;

function syncGameVisibility(): void {
  game.value?.getGameTimer().setPageVisible(document.visibilityState !== 'hidden');
}

function reportLoadError(error: unknown): void {
  loadError.value = error instanceof Error
    ? error.message
    : 'Unable to load the original game data.';
}

async function start(replayString?: string): Promise<void> {
  level.value = undefined;

  if (game.value) {
    game.value.getGameTimer().resume();
    return;
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
    return;
  }
  if (!nextGame) {
    log.log('Unable to create game!');
    return;
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
  nextGame.start();

  gameState.value = GameStateTypeHelper.toString(GameStateTypes.RUNNING);
  game.value = nextGame;
}

function onGameEnd(result?: GameResult): void {
  if (!result) {
    return;
  }

  gameState.value = GameStateTypeHelper.toString(result.state);
  stage.value?.startFadeOut();

  gameEndTimeout = window.setTimeout(() => {
    void moveToLevel(result.state === GameStateTypes.SUCCEEDED ? 1 : 0);
  }, 2500);
}

function stopMusic(): void {
  musicPlayer.value?.stop();
  musicPlayer.value = undefined;
}

async function playMusic(moveInterval = 0): Promise<void> {
  stopMusic();
  if (!gameResources.value) {
    return;
  }

  musicIndex.value = Math.max(0, musicIndex.value + moveInterval);
  musicPlayer.value = await gameResources.value.getMusicPlayer(musicIndex.value);
  musicPlayer.value.play();
}

function stopSound(): void {
  soundPlayer.value?.stop();
  soundPlayer.value = undefined;
}

async function playSound(moveInterval = 0): Promise<void> {
  stopSound();
  if (!gameResources.value) {
    return;
  }

  soundIndex.value = Math.max(0, soundIndex.value + moveInterval);
  soundPlayer.value = await gameResources.value.getSoundPlayer(soundIndex.value);
  soundPlayer.value.play();
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

  game.value?.stop();
  game.value = undefined;
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
    >
      Sorry! Your browser does not support HTML Canvas and cannot run this game.
    </canvas>

    <div
      v-if="level"
      class="levelName"
    >
      {{ level.name }}
    </div>

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
        @click="moveToLevel(-1)"
      >
        ⇦
      </button>
      <button
        type="button"
        @click="start()"
      >
        Start
      </button>
      <button
        type="button"
        aria-label="Next level"
        @click="moveToLevel(1)"
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

  .levelName,
  .controls {
    margin: 0.75rem;
  }

  .loadError {
    max-width: 40rem;
    margin: 1rem auto;
    padding: 0.75rem 1rem;
    background: #240000;
    color: #ffb3b3;
    border: 1px solid #b00020;
  }

  .controls {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

</style>
