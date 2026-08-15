import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBrowserDataSourceResolver,
  getActiveDataSource,
  removeLocalSource,
  requestStoredDirectoryPermission,
  restoreDirectory,
  selectDirectory,
  useSelectedFiles,
} from '@/game/data/browser-data-sources';
import { validateEdition } from '@/game/data/data-validation';
import {
  EDITION_MANIFESTS,
  type EditionManifest,
} from '@/game/data/edition-manifests';
import {
  LocalFileDataSource,
  MAX_SESSION_FILE_COUNT,
  type LocalDataFile,
  type FileSystemDirectoryHandleLike,
} from '@/game/data/local-data-source';
import { GameTypes } from '@/game/game-types';
import { FileProvider } from '@/game/resources/file/file-provider';
import {
  applyStaticValidation,
  type DataSetupValidationState,
} from '@/views/data-setup-state';
import { buildRawContainer } from '../fixtures/binary-fixtures';

function localFile(name: string, bytes: Uint8Array): LocalDataFile {
  return {
    name,
    size: bytes.byteLength,
    async arrayBuffer() {
      return bytes.slice().buffer;
    },
    async text() {
      return new TextDecoder().decode(bytes);
    },
  };
}

function manifest(
  id: string,
  required: Array<{ name: string; bytes: Uint8Array; structure?: 'container' | 'raw' }>,
): EditionManifest {
  return {
    gameType: GameTypes.LEMMINGS,
    id,
    name: id,
    path: id,
    required: required.map(({ name, bytes, structure = 'raw' }) => ({
      name,
      minBytes: bytes.byteLength,
      maxBytes: bytes.byteLength,
      structure,
    })),
    optional: ['README.md', 'toolbar.png'],
  };
}

describe('local game-data sources', () => {
  it('loads selected files case-insensitively while preserving their actual names', async () => {
    const source = new LocalFileDataSource([
      localFile('main.dat', Uint8Array.from([1, 2, 3])),
    ]);

    const reader = await source.loadBinary('ignored-edition-path', 'MAIN.DAT');

    expect(reader.fileName).toBe('main.dat');
    expect(await source.listFiles('ignored')).toEqual([{ name: 'main.dat', size: 3 }]);
  });

  it('rejects HTML fallbacks and ambiguous case-only duplicate filenames', async () => {
    const html = new TextEncoder().encode('<!doctype html><title>Not data</title>');
    const source = new LocalFileDataSource([localFile('MAIN.DAT', html)]);

    await expect(source.loadBinary('', 'MAIN.DAT')).rejects.toMatchObject({
      code: 'html-fallback',
      filename: 'MAIN.DAT',
    });
    expect(() => new LocalFileDataSource([
      localFile('MAIN.DAT', Uint8Array.of(1)),
      localFile('main.dat', Uint8Array.of(2)),
    ])).toThrow(/more than one file/);
  });

  it('caps session folder imports to a reasonable number of files', () => {
    const files = Array.from({ length: MAX_SESSION_FILE_COUNT + 1 }, (_, index) => (
      localFile(`FILE${index}.DAT`, Uint8Array.of(index % 256))
    ));

    expect(() => new LocalFileDataSource(files)).toThrow(/more than 512 files/);
  });
});

describe('static game-data sources', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects an HTML body even when the server reports a binary content type', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      '<!doctype html><title>Missing</title>',
      { headers: { 'Content-Type': 'application/octet-stream' } },
    )));

    await expect(new FileProvider('/data').loadBinary('lemmings', 'MAIN.DAT'))
      .rejects.toMatchObject({ code: 'html-fallback', filename: 'MAIN.DAT' });
  });

  it('checks static files without replacing the selected gameplay source', async () => {
    const edition = manifest('static-check-test', [
      { name: 'MAIN.DAT', bytes: Uint8Array.of(1, 2, 3) },
    ]);
    const selected = useSelectedFiles(edition.path, [
      localFile('MAIN.DAT', Uint8Array.of(4, 5, 6)),
    ]);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      Uint8Array.of(1, 2, 3),
      { headers: { 'Content-Type': 'application/octet-stream' } },
    )));

    try {
      const result = await validateEdition(new FileProvider('/data'), edition, [edition]);

      expect(result.readiness).toBe('ready');
      expect(getActiveDataSource(edition.path)).toBe(selected);
      expect(createBrowserDataSourceResolver('/data').resolve(edition.path)).toBe(selected);
    } finally {
      await removeLocalSource(edition.path);
    }
  });

  it('keeps the gameplay status visible when a local source is active', () => {
    const edition = manifest('status-test', [
      { name: 'MAIN.DAT', bytes: Uint8Array.of(1) },
    ]);
    const gameplayResult = {
      edition,
      sourceLabel: 'selected local files',
      readiness: 'ready' as const,
      checkedFiles: 1,
      issues: [],
    };
    const staticResult = {
      ...gameplayResult,
      sourceLabel: 'static data folder',
      readiness: 'incomplete' as const,
    };
    const state: DataSetupValidationState = {
      localActive: true,
      message: 'Ready from selected local files.',
      result: gameplayResult,
    };

    applyStaticValidation(state, staticResult, true);

    expect(state.result).toBe(gameplayResult);
    expect(state.message).toBe('Ready from selected local files.');
    expect(state.staticResult).toBe(staticResult);
    expect(state.staticMessage).toContain('remains active for gameplay');
  });
});

describe('edition setup documentation', () => {
  it('lists every required manifest file in its edition README', async () => {
    await Promise.all(EDITION_MANIFESTS.map(async (edition) => {
      const readme = await readFile(
        new URL(`../../public/data/${edition.path}/README.md`, import.meta.url),
        'utf8',
      );

      for (const requirement of edition.required) {
        expect(readme, `${edition.name} README is missing ${requirement.name}`)
          .toContain(requirement.name);
      }
    }));
  });
});

describe('reusable directory permissions', () => {
  const originalWindow = globalThis.window;

  afterEach(async () => {
    await Promise.all([
      removeLocalSource('permission-test'),
      removeLocalSource('denied-test'),
    ]);
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, 'window');
    } else {
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
    }
  });

  it('restores, expires, and re-requests a saved read-only folder permission', async () => {
    let permission: PermissionState = 'granted';
    const requestPermission = vi.fn(async () => {
      permission = 'granted';
      return permission;
    });
    const handle: FileSystemDirectoryHandleLike = {
      kind: 'directory',
      name: 'Lemmings',
      async getFileHandle() {
        throw new DOMException('Missing', 'NotFoundError');
      },
      async *values() {
        // The permission lifecycle does not need actual files.
      },
      async queryPermission() {
        return permission;
      },
      requestPermission,
    };
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { showDirectoryPicker: async () => handle },
    });

    const selection = await selectDirectory('permission-test');
    expect(selection.persisted).toBe(false);
    expect(createBrowserDataSourceResolver('/data').resolve('permission-test').kind)
      .toBe('directory-handle');
    expect(await restoreDirectory('permission-test')).toBe('granted');

    permission = 'prompt';
    expect(await restoreDirectory('permission-test')).toBe('permission-needed');
    expect(createBrowserDataSourceResolver('/data').resolve('permission-test').kind)
      .toBe('http');

    expect(await requestStoredDirectoryPermission('permission-test')).toBe('granted');
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it('does not activate a folder when the player denies access', async () => {
    const handle: FileSystemDirectoryHandleLike = {
      kind: 'directory',
      name: 'Denied',
      async getFileHandle() {
        throw new DOMException('Missing', 'NotFoundError');
      },
      async *values() {},
      async queryPermission() {
        return 'prompt';
      },
      async requestPermission() {
        return 'denied';
      },
    };
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { showDirectoryPicker: async () => handle },
    });

    await expect(selectDirectory('denied-test')).rejects.toThrow(/not granted/);
    expect(createBrowserDataSourceResolver('/data').resolve('denied-test').kind).toBe('http');
  });
});

describe('edition validation', () => {
  it('accepts structurally valid containers and explains repairable filename case', async () => {
    const container = buildRawContainer(Uint8Array.of(0x41, 0x42));
    const raw = Uint8Array.of(1, 2, 3, 4);
    const edition = manifest('standard', [
      { name: 'MAIN.DAT', bytes: container, structure: 'container' },
      { name: 'GROUND0O.DAT', bytes: raw },
    ]);
    const source = new LocalFileDataSource([
      localFile('main.dat', container),
      localFile('GROUND0O.DAT', raw),
    ]);

    const result = await validateEdition(source, edition, [edition]);

    expect(result.readiness).toBe('ready');
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'case-mismatch', filename: 'main.dat' }),
    ]);
  });

  it('distinguishes incomplete, wrong-edition, and corrupt file sets', async () => {
    const bytes = Uint8Array.of(1, 2, 3);
    const standard = manifest('standard', [
      { name: 'LEVEL000.DAT', bytes },
      { name: 'LEVEL001.DAT', bytes },
      { name: 'ODDTABLE.DAT', bytes },
    ]);
    const expansion = manifest('expansion', [
      { name: 'DLVEL000.DAT', bytes },
      { name: 'DLVEL001.DAT', bytes },
      { name: 'DLVEL002.DAT', bytes },
    ]);
    const wrongSource = new LocalFileDataSource(expansion.required.map(
      (file) => localFile(file.name, bytes),
    ));
    const wrong = await validateEdition(wrongSource, standard, [standard, expansion]);

    expect(wrong.readiness).toBe('wrong-edition');
    expect(wrong.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'wrong-edition' }),
      expect.objectContaining({ code: 'missing', filename: 'LEVEL000.DAT' }),
    ]));

    const incomplete = await validateEdition(
      new LocalFileDataSource([localFile('LEVEL000.DAT', bytes)]),
      standard,
      [standard],
    );
    expect(incomplete.readiness).toBe('incomplete');

    const corruptManifest = manifest('corrupt', [
      { name: 'MAIN.DAT', bytes, structure: 'container' },
    ]);
    const corrupt = await validateEdition(
      new LocalFileDataSource([localFile('MAIN.DAT', bytes)]),
      corruptManifest,
      [corruptManifest],
    );
    expect(corrupt.readiness).toBe('corrupt');
    expect(corrupt.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'corrupt-container' }),
    ]));
  });

  it('warns about known-size variants and unexpected mixed-edition files', async () => {
    const expected = Uint8Array.of(1, 2, 3);
    const actual = Uint8Array.of(1, 2, 3, 4);
    const standard = manifest('standard', [{ name: 'MAIN.DAT', bytes: expected }]);
    const expansion = manifest('expansion', [{ name: 'DLVEL000.DAT', bytes: expected }]);
    const source = new LocalFileDataSource([
      localFile('MAIN.DAT', actual),
      localFile('DLVEL000.DAT', expected),
      localFile('NOTES.TXT', expected),
    ]);

    const result = await validateEdition(source, standard, [standard, expansion]);

    expect(result.readiness).toBe('ready');
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'mixed-edition',
      'size-mismatch',
      'unexpected',
    ]));
  });
});
