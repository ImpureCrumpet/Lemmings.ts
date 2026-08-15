<script setup lang="ts">
import { onMounted, ref } from 'vue';
import {
  createBrowserDataSourceResolver,
  getActiveDataSource,
  removeLocalSource,
  requestStoredDirectoryPermission,
  restoreDirectory,
  selectDirectory,
  supportsDirectoryPicker,
  useSelectedFiles,
} from '@/game/data/browser-data-sources';
import {
  EDITION_MANIFESTS,
  type EditionManifest,
} from '@/game/data/edition-manifests';
import {
  validateEdition,
} from '@/game/data/data-validation';
import { FileProvider } from '@/game/resources/file/file-provider';
import {
  applyStaticValidation,
  readinessMessage,
  type DataSetupValidationState,
} from './data-setup-state';

interface EditionSetupState extends DataSetupValidationState {
  checking: boolean;
  staticChecking: boolean;
  permissionNeeded: boolean;
}

const staticRoot = `${import.meta.env.BASE_URL}data`;
const activeResolver = createBrowserDataSourceResolver(staticRoot);
const staticSource = new FileProvider(staticRoot);
const directoryPickerSupported = supportsDirectoryPicker();
const states = ref<Record<string, EditionSetupState>>(
  Object.fromEntries(EDITION_MANIFESTS.map((edition) => [edition.id, {
    checking: false,
    staticChecking: false,
    permissionNeeded: false,
    localActive: false,
    message: 'Gameplay source not checked yet.',
  }])),
);
const folderInput = ref<HTMLInputElement>();
let pendingFileEdition: EditionManifest | undefined;

function stateFor(edition: EditionManifest): EditionSetupState {
  return states.value[edition.id];
}

async function checkSource(edition: EditionManifest): Promise<void> {
  const state = stateFor(edition);
  state.checking = true;
  state.message = 'Checking files…';
  try {
    const source = activeResolver.resolve(edition.path);
    state.result = await validateEdition(source, edition);
    state.localActive = Boolean(getActiveDataSource(edition.path));
    state.permissionNeeded = false;
    state.message = readinessMessage(state.result);
    if (state.localActive && state.staticResult) {
      applyStaticValidation(state, state.staticResult, true);
    }
  } catch (error) {
    state.message = error instanceof Error ? error.message : 'Unable to check this edition.';
  } finally {
    state.checking = false;
  }
}

async function checkStaticFolder(edition: EditionManifest): Promise<void> {
  const state = stateFor(edition);
  state.staticChecking = true;
  state.staticMessage = 'Checking static folder…';
  try {
    const result = await validateEdition(staticSource, edition);
    applyStaticValidation(state, result, Boolean(getActiveDataSource(edition.path)));
  } catch (error) {
    state.staticMessage = error instanceof Error
      ? error.message
      : 'Unable to check the static folder.';
  } finally {
    state.staticChecking = false;
  }
}

async function chooseReusableFolder(edition: EditionManifest): Promise<void> {
  const state = stateFor(edition);
  state.checking = true;
  try {
    const selection = await selectDirectory(edition.path);
    await checkSource(edition);
    state.localActive = true;
    if (!selection.persisted) {
      state.message += ' Browser storage could not save this folder, so choose it again next session.';
    }
  } catch (error) {
    state.message = error instanceof Error ? error.message : 'Folder selection was cancelled.';
    state.checking = false;
  }
}

function openFolderInput(edition: EditionManifest): void {
  pendingFileEdition = edition;
  folderInput.value?.click();
}

async function useFolderFiles(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  input.value = '';
  const edition = pendingFileEdition;
  pendingFileEdition = undefined;
  if (!edition || files.length === 0) {
    return;
  }
  try {
    useSelectedFiles(edition.path, files);
    stateFor(edition).localActive = true;
    await checkSource(edition);
  } catch (error) {
    stateFor(edition).message = error instanceof Error
      ? error.message
      : 'The selected files could not be used.';
  }
}

async function grantAgain(edition: EditionManifest): Promise<void> {
  const state = stateFor(edition);
  state.checking = true;
  try {
    const access = await requestStoredDirectoryPermission(edition.path);
    state.permissionNeeded = access === 'permission-needed';
    if (access === 'granted') {
      state.localActive = true;
      await checkSource(edition);
    } else {
      state.message = access === 'unavailable'
        ? 'The saved folder is no longer available. Choose it again.'
        : 'Folder access was not granted.';
    }
  } finally {
    state.checking = false;
  }
}

async function removeFolder(edition: EditionManifest): Promise<void> {
  await removeLocalSource(edition.path);
  const state = stateFor(edition);
  state.permissionNeeded = false;
  state.localActive = false;
  if (state.staticResult) {
    state.result = state.staticResult;
    state.message = readinessMessage(state.staticResult);
    state.staticMessage = undefined;
  } else {
    state.result = undefined;
    state.message = 'Local folder removed. Static hosting is now the default.';
  }
}

onMounted(async () => {
  await Promise.all(EDITION_MANIFESTS.map(async (edition) => {
    const access = await restoreDirectory(edition.path);
    const state = stateFor(edition);
    state.permissionNeeded = access === 'permission-needed';
    if (access === 'granted' || getActiveDataSource(edition.path)) {
      state.localActive = true;
      await checkSource(edition);
    } else if (access === 'permission-needed') {
      state.message = 'The saved folder needs permission again.';
    }
  }));
});
</script>

<template>
  <main class="setupPage">
    <header>
      <router-link to="/">
        ← Back to Lemmings.ts
      </router-link>
      <h1>Set up original game files</h1>
      <p>
        Choose only files you legally obtained. Folder contents stay on this device:
        Lemmings.ts has no upload step, account, or analytics endpoint.
      </p>
      <p>
        For local development or self-hosting, you can instead copy files into
        <code>public/data/&lt;edition&gt;</code> and check the static folder.
      </p>
    </header>

    <input
      ref="folderInput"
      class="visuallyHidden"
      type="file"
      multiple
      webkitdirectory
      aria-label="Choose an edition folder"
      @change="useFolderFiles"
    >

    <section
      v-for="edition in EDITION_MANIFESTS"
      :key="edition.id"
      class="editionCard"
      :aria-labelledby="`${edition.id}-heading`"
    >
      <div class="editionHeading">
        <div>
          <h2 :id="`${edition.id}-heading`">
            {{ edition.name }}
          </h2>
          <p
            class="status"
            :class="stateFor(edition).result?.readiness"
            role="status"
          >
            {{ stateFor(edition).message }}
          </p>
          <p
            v-if="stateFor(edition).staticMessage"
            class="status staticStatus"
            :class="stateFor(edition).staticResult?.readiness"
            role="status"
          >
            Static-folder check: {{ stateFor(edition).staticMessage }}
          </p>
        </div>
        <span class="fileCount">{{ edition.required.length }} required files</span>
      </div>

      <div class="actions">
        <button
          v-if="directoryPickerSupported"
          type="button"
          :disabled="stateFor(edition).checking || stateFor(edition).staticChecking"
          @click="chooseReusableFolder(edition)"
        >
          Choose reusable folder
        </button>
        <button
          type="button"
          :disabled="stateFor(edition).checking || stateFor(edition).staticChecking"
          @click="openFolderInput(edition)"
        >
          Choose folder for this session
        </button>
        <button
          type="button"
          :disabled="stateFor(edition).checking || stateFor(edition).staticChecking"
          @click="checkStaticFolder(edition)"
        >
          Check static folder
        </button>
        <button
          v-if="stateFor(edition).permissionNeeded"
          type="button"
          :disabled="stateFor(edition).checking || stateFor(edition).staticChecking"
          @click="grantAgain(edition)"
        >
          Grant folder access again
        </button>
        <button
          v-if="stateFor(edition).localActive || stateFor(edition).permissionNeeded"
          type="button"
          class="secondary"
          :disabled="stateFor(edition).checking || stateFor(edition).staticChecking"
          @click="removeFolder(edition)"
        >
          Remove local folder
        </button>
      </div>

      <details v-if="stateFor(edition).result">
        <summary>
          Gameplay file checklist
          ({{ stateFor(edition).result?.issues.length ?? 0 }} issues)
        </summary>
        <p v-if="stateFor(edition).result?.issues.length === 0">
          Every required file is readable and passed its structural check.
        </p>
        <ul
          v-else
          class="issueList"
        >
          <li
            v-for="(issue, index) in stateFor(edition).result?.issues"
            :key="`${issue.code}-${issue.filename ?? index}`"
            :class="issue.severity"
          >
            <strong>{{ issue.filename ? `${issue.filename}: ` : '' }}{{ issue.message }}</strong>
            {{ issue.correction }}
          </li>
        </ul>
        <details>
          <summary>Required filenames</summary>
          <ul class="filenameList">
            <li
              v-for="file in edition.required"
              :key="file.name"
            >
              <code>{{ file.name }}</code> · known size {{ file.minBytes.toLocaleString() }} bytes
            </li>
          </ul>
        </details>
      </details>

      <details v-if="stateFor(edition).localActive && stateFor(edition).staticResult">
        <summary>
          Static-folder checklist
          ({{ stateFor(edition).staticResult?.issues.length ?? 0 }} issues)
        </summary>
        <p v-if="stateFor(edition).staticResult?.issues.length === 0">
          Every required static file is readable and passed its structural check.
        </p>
        <ul
          v-else
          class="issueList"
        >
          <li
            v-for="(issue, index) in stateFor(edition).staticResult?.issues"
            :key="`static-${issue.code}-${issue.filename ?? index}`"
            :class="issue.severity"
          >
            <strong>{{ issue.filename ? `${issue.filename}: ` : '' }}{{ issue.message }}</strong>
            {{ issue.correction }}
          </li>
        </ul>
      </details>
    </section>

    <footer>
      <p>
        Browsers without reusable folder access can use the session button above,
        or the manual-copy approach described in the project documentation.
      </p>
      <router-link to="/">
        Return to the game
      </router-link>
    </footer>
  </main>
</template>

<style scoped>
.setupPage {
  min-height: 100vh;
  padding: 1.5rem;
  box-sizing: border-box;
  background: #090d0a;
  color: #f4f4e8;
  text-align: left;
}

header,
footer,
.editionCard {
  max-width: 64rem;
  margin: 0 auto 1rem;
}

a {
  color: #9ee89a;
}

code {
  color: #ffe976;
}

.editionCard {
  padding: 1rem;
  border: 1px solid #526254;
  border-radius: 0.5rem;
  background: #131a14;
}

.editionHeading,
.actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

h2 {
  margin: 0;
}

.status {
  margin: 0.35rem 0;
  color: #c4cbc4;
}

.staticStatus {
  padding-left: 0.75rem;
  border-left: 3px solid #526254;
}

.status.ready {
  color: #8dff85;
}

.status.incomplete,
.status.wrong-edition,
.status.corrupt,
.status.unreadable,
.issueList .error {
  color: #ffaaa4;
}

.fileCount {
  color: #c4cbc4;
}

button {
  min-height: 44px;
  padding: 0.55rem 0.85rem;
  border: 2px solid #8eb890;
  border-radius: 0.35rem;
  background: #203822;
  color: #fff;
  font: inherit;
  cursor: pointer;
}

button.secondary {
  border-color: #7b7b7b;
  background: #272727;
}

button:disabled {
  opacity: 0.55;
  cursor: wait;
}

details {
  margin-top: 0.8rem;
}

summary {
  cursor: pointer;
  font-weight: 700;
}

.issueList,
.filenameList {
  padding-left: 1.5rem;
}

.issueList li,
.filenameList li {
  margin: 0.4rem 0;
}

.issueList .warning {
  color: #ffe49b;
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
</style>
