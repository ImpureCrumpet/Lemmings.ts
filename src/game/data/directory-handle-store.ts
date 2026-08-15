import type { FileSystemDirectoryHandleLike } from './local-data-source';

const DATABASE_NAME = 'lemmings.ts.data-sources';
const DATABASE_VERSION = 1;
const STORE_NAME = 'edition-directories';

function openDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open browser storage.'));
  });
}

async function runRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  try {
    const database = await openDatabase();
    if (!database) {
      return undefined;
    }
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Browser storage request failed.'));
      transaction.oncomplete = () => database.close();
    });
  } catch {
    return undefined;
  }
}

export async function saveDirectoryHandle(
  editionPath: string,
  handle: FileSystemDirectoryHandleLike,
): Promise<boolean> {
  const result = await runRequest('readwrite', (store) => store.put(handle, editionPath));
  return result !== undefined;
}

export async function loadDirectoryHandle(
  editionPath: string,
): Promise<FileSystemDirectoryHandleLike | undefined> {
  return runRequest('readonly', (store) => store.get(editionPath));
}

export async function removeDirectoryHandle(editionPath: string): Promise<void> {
  await runRequest('readwrite', (store) => store.delete(editionPath));
}
