import { FileProvider } from '@/game/resources/file/file-provider';
import type {
  ResourceDataSource,
  ResourceDataSourceResolver,
} from '@/game/resources/file/resource-data-source';
import {
  loadDirectoryHandle,
  removeDirectoryHandle,
  saveDirectoryHandle,
} from './directory-handle-store';
import {
  DirectoryHandleDataSource,
  LocalFileDataSource,
  type FileSystemDirectoryHandleLike,
  type LocalDataFile,
} from './local-data-source';

export type DirectoryAccessState = 'granted' | 'permission-needed' | 'unavailable';

export interface DirectorySelectionResult {
  readonly source: ResourceDataSource;
  readonly persisted: boolean;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: { mode?: 'read' }) => Promise<FileSystemDirectoryHandleLike>;
}

const localSources = new Map<string, ResourceDataSource>();
const storedDirectoryHandles = new Map<string, FileSystemDirectoryHandleLike>();

export function createBrowserDataSourceResolver(staticRoot: string): ResourceDataSourceResolver {
  const staticSource = new FileProvider(staticRoot);
  return {
    resolve: (editionPath: string) => localSources.get(editionPath) ?? staticSource,
  };
}

export function getActiveDataSource(editionPath: string): ResourceDataSource | undefined {
  return localSources.get(editionPath);
}

export function useSelectedFiles(editionPath: string, files: Iterable<LocalDataFile>): ResourceDataSource {
  const source = new LocalFileDataSource(files);
  localSources.set(editionPath, source);
  return source;
}

export function supportsDirectoryPicker(): boolean {
  return typeof window !== 'undefined'
    && typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';
}

async function getPermission(
  handle: FileSystemDirectoryHandleLike,
  request: boolean,
): Promise<PermissionState> {
  const current = await handle.queryPermission?.({ mode: 'read' }) ?? 'prompt';
  if (current === 'granted' || !request) {
    return current;
  }
  return handle.requestPermission?.({ mode: 'read' }) ?? 'denied';
}

export async function selectDirectory(editionPath: string): Promise<DirectorySelectionResult> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new Error('This browser does not support choosing a reusable folder.');
  }
  const handle = await picker({ mode: 'read' });
  if (await getPermission(handle, true) !== 'granted') {
    throw new Error('Folder access was not granted.');
  }
  const source = new DirectoryHandleDataSource(handle);
  localSources.set(editionPath, source);
  storedDirectoryHandles.set(editionPath, handle);
  const persisted = await saveDirectoryHandle(editionPath, handle);
  return { source, persisted };
}

export async function restoreDirectory(editionPath: string): Promise<DirectoryAccessState> {
  const handle = storedDirectoryHandles.get(editionPath) ?? await loadDirectoryHandle(editionPath);
  if (!handle) {
    return 'unavailable';
  }
  storedDirectoryHandles.set(editionPath, handle);
  try {
    if (await getPermission(handle, false) !== 'granted') {
      localSources.delete(editionPath);
      return 'permission-needed';
    }
  } catch {
    localSources.delete(editionPath);
    return 'permission-needed';
  }
  localSources.set(editionPath, new DirectoryHandleDataSource(handle));
  return 'granted';
}

export async function requestStoredDirectoryPermission(
  editionPath: string,
): Promise<DirectoryAccessState> {
  const handle = storedDirectoryHandles.get(editionPath) ?? await loadDirectoryHandle(editionPath);
  if (!handle) {
    return 'unavailable';
  }
  storedDirectoryHandles.set(editionPath, handle);
  try {
    if (await getPermission(handle, true) !== 'granted') {
      localSources.delete(editionPath);
      return 'permission-needed';
    }
  } catch {
    localSources.delete(editionPath);
    return 'permission-needed';
  }
  localSources.set(editionPath, new DirectoryHandleDataSource(handle));
  return 'granted';
}

export async function removeLocalSource(editionPath: string): Promise<void> {
  localSources.delete(editionPath);
  storedDirectoryHandles.delete(editionPath);
  await removeDirectoryHandle(editionPath);
}
