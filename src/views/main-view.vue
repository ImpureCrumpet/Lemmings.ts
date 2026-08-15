<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue';
import { GameFactory } from '@/game/game-factory';
import { GameTypes, GameTypesHelper } from '@/game/game-types';
import type { GameResources } from '@/game/game-resources';
import { createBrowserPlayerStorage } from '@/game/persistence/player-storage';
import { LogHandler } from '@/game/utilities/log-handler';
import {
  createBrowserDataSourceResolver,
  restoreDirectory,
} from '@/game/data/browser-data-sources';

const log = new LogHandler('MainView');
const dataRoot = `${import.meta.env.BASE_URL}data`;
const gameFactory = new GameFactory(dataRoot, createBrowserDataSourceResolver(dataRoot));
const playerStorage = createBrowserPlayerStorage();

const levelIndex = ref(0);
const levelGroupIndex = ref(0);
const gameType = ref(GameTypes.LEMMINGS);
const gameResources = shallowRef<GameResources>();

const backgroundImage = ref('');
const logo = ref('');
const f1 = ref('');
const f2 = ref('');
const f3 = ref('');
const f4 = ref('');
const exit = ref('');
const leftScroll = ref('');
const rightScroll = ref('');
const reel = ref('');
const loadError = ref('');

async function showStartView(): Promise<void> {
  if (!gameResources.value) {
    return;
  }

  const images = await gameResources.value.getMainImageSprites();

  backgroundImage.value = images.getBackground().getImageUrl();
  logo.value = images.getLogo().getImage();
  f1.value = images.getF1().getImage();
  f2.value = images.getF2().getImage();
  f3.value = images.getF3().getImage();
  f4.value = images.getF4().getImage();
  exit.value = images.getExit().getImage();
  leftScroll.value = images.getLeftScroll().getImage();
  rightScroll.value = images.getRightScroll().getImage();
  reel.value = images.getReel().getImageUrl();
}

async function selectGameType(moveValue = 0): Promise<void> {
  loadError.value = '';
  const playableEditionCount = GameTypesHelper.count() - 1;
  gameType.value = (
    (gameType.value - 1 + moveValue + playableEditionCount) % playableEditionCount
  ) + 1;

  log.log(`game type: ${gameType.value}`);
  try {
    const config = await gameFactory.getConfig(gameType.value);
    if (config) {
      await restoreDirectory(config.path);
    }
    const resources = await gameFactory.getGameResources(gameType.value);
    if (!resources) {
      log.log('Unable to get game resources');
      return;
    }
    gameResources.value = resources;
    levelGroupIndex.value = 0;

    await showStartView();
  } catch (error) {
    loadError.value = error instanceof Error
      ? error.message
      : 'Unable to load the original game data.';
  }
}

onMounted(() => {
  const savedEdition = playerStorage.loadProgress().lastLocation?.editionId;
  if (savedEdition) {
    const savedGameType = GameTypesHelper.fromString(savedEdition);
    if (GameTypesHelper.isValid(savedGameType)) {
      gameType.value = savedGameType;
    }
  }
  log.log(
    `selected level: ${GameTypesHelper.toString(gameType.value)} : ${levelIndex.value} / ${levelGroupIndex.value}`,
  );
  void selectGameType();
});
</script>

<template>
  <div class="root">
    <button
      class="switch"
      type="button"
      aria-label="Previous game"
      @click="selectGameType(-1)"
    >
      ❮
    </button>

    <main
      class="main"
      :style="{ backgroundImage }"
    >
      <p
        v-if="loadError"
        class="loadError"
        role="alert"
      >
        {{ loadError }}
        <router-link to="/setup">
          Set up or check game files.
        </router-link>
      </p>

      <router-link
        class="setupLink"
        to="/setup"
      >
        Set up original game files
      </router-link>

      <img
        :src="logo"
        class="logo"
        alt="Lemmings"
      >

      <div>
        <router-link
          :to="{ name: 'game', params: { gameType } }"
          aria-label="Play"
        >
          <img
            :src="f1"
            class="lemButton"
            alt="Play"
          >
        </router-link>

        <img
          :src="f2"
          class="lemButton"
          alt=""
        >
        <img
          :src="f3"
          class="lemButton"
          alt=""
        >
        <img
          :src="f4"
          class="lemButton"
          alt=""
        >
        <img
          :src="exit"
          class="lemButton"
          alt="Exit"
        >
      </div>

      <div class="reelRow">
        <img
          :src="leftScroll"
          alt=""
        >
        <div
          :style="{ backgroundImage: reel }"
          class="reel"
        >
          Lemmings.ts
        </div>
        <img
          :src="rightScroll"
          alt=""
        >
      </div>
    </main>

    <button
      class="switch"
      type="button"
      aria-label="Next game"
      @click="selectGameType(1)"
    >
      ❯
    </button>
  </div>
</template>

<style scoped>
  .root {
    position: fixed;
    inset: 0;
    display: flex;
    width: 100%;
    padding: 0;
    margin: 0;
  }

  .reel {
    width: 60%;
    height: 16px;
    font-size: 13px;
    font-weight: bold;
    display: inline-block;
    vertical-align: top;
    border: 0;
    padding: 0;
    margin: 0;
    background-repeat: repeat-x;
  }

  .lemButton {
    padding: 10px;
  }

  .logo {
    max-width: 90%;
    padding: 20px 0;
    image-rendering: pixelated;
  }

  .loadError {
    max-width: 40rem;
    margin: 1rem auto;
    padding: 0.75rem 1rem;
    background: #240000;
    color: #ffb3b3;
    border: 1px solid #b00020;
  }

  .loadError a,
  .setupLink {
    color: #baffb5;
  }

  .setupLink {
    display: block;
    margin: 0.5rem;
  }

  .switch {
    font-size: 10vw;
    height: 100%;
    width: 10%;
    background-color: black;
    color: white;
    border: none;
  }

  .switch:hover {
    background-color: darkgray;
  }

  .main {
    overflow: auto;
    height: 100%;
    width: 80%;
    background-repeat: repeat;
  }

  .lemButton,
  .reelRow img {
    image-rendering: pixelated;
  }

  .reelRow {
    display: flex;
    align-items: start;
    justify-content: center;
    margin-top: 3rem;
  }

</style>
