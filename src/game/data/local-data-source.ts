import { Frame } from '@/game/resources/frame';
import { BinaryReader } from '@/game/resources/file/binary-reader';
import {
  DataSourceError,
  isHtmlDocument,
  type DataSourceFileInfo,
  type ResourceDataSource,
} from '@/game/resources/file/resource-data-source';

export const MAX_SESSION_FILE_COUNT = 512;

export interface LocalDataFile {
  readonly name: string;
  readonly size: number;
  readonly type?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

export interface FileSystemFileHandleLike {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<LocalDataFile>;
}

export interface FileSystemDirectoryHandleLike {
  readonly kind: 'directory';
  readonly name: string;
  getFileHandle(name: string): Promise<FileSystemFileHandleLike>;
  values(): AsyncIterableIterator<FileSystemFileHandleLike | FileSystemDirectoryHandleLike>;
  queryPermission?(descriptor?: { mode: 'read' }): Promise<PermissionState>;
  requestPermission?(descriptor?: { mode: 'read' }): Promise<PermissionState>;
}

function keyFor(filename: string): string {
  return filename.trim().toLocaleUpperCase('en-US');
}

async function decodeImage(file: LocalDataFile): Promise<Frame | undefined> {
  if (file.type && !file.type.startsWith('image/')) {
    return undefined;
  }

  const bitmap = await createImageBitmap(new Blob([await file.arrayBuffer()], {
    type: file.type ?? 'application/octet-stream',
  }));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error(`Unable to decode ${file.name}`);
    }
    context.drawImage(bitmap, 0, 0);
    return Frame.fromImageData(context.getImageData(0, 0, bitmap.width, bitmap.height));
  } finally {
    bitmap.close();
  }
}

abstract class LocalDataSourceBase implements ResourceDataSource {
  public abstract readonly kind: 'local-files' | 'directory-handle';
  public abstract readonly label: string;

  protected abstract findFile(filename: string): Promise<LocalDataFile | undefined>;
  public abstract listFiles(path: string): Promise<readonly DataSourceFileInfo[]>;

  public async loadBinary(_path: string, filename = ''): Promise<BinaryReader> {
    const file = await this.findFile(filename);
    if (!file) {
      throw new DataSourceError(
        'missing',
        filename,
        `${filename} is missing from the selected folder.`,
      );
    }

    try {
      const data = await file.arrayBuffer();
      if (isHtmlDocument(data)) {
        throw new DataSourceError(
          'html-fallback',
          file.name,
          `${file.name} contains a web page instead of game data.`,
        );
      }
      return new BinaryReader(data, 0, null, file.name);
    } catch (error) {
      if (error instanceof DataSourceError) {
        throw error;
      }
      throw new DataSourceError(
        'unreadable',
        file.name,
        `${file.name} could not be read from the selected folder.`,
        { cause: error },
      );
    }
  }

  public async loadString(_path: string, filename = ''): Promise<string> {
    const file = await this.findFile(filename);
    if (!file) {
      throw new DataSourceError('missing', filename, `${filename} is missing from the selected folder.`);
    }
    try {
      return await file.text();
    } catch (error) {
      throw new DataSourceError(
        'unreadable',
        file.name,
        `${file.name} could not be read from the selected folder.`,
        { cause: error },
      );
    }
  }

  public async loadOptionalImage(_path: string, filename: string): Promise<Frame | undefined> {
    const file = await this.findFile(filename);
    return file ? decodeImage(file) : undefined;
  }
}

export class LocalFileDataSource extends LocalDataSourceBase {
  public readonly kind = 'local-files' as const;
  public readonly label = 'selected local files';
  private readonly filesByName = new Map<string, LocalDataFile>();

  public constructor(files: Iterable<LocalDataFile>) {
    super();
    for (const file of files) {
      if (this.filesByName.size >= MAX_SESSION_FILE_COUNT) {
        throw new Error(
          `The selected folder contains more than ${MAX_SESSION_FILE_COUNT} files. Choose the edition folder itself.`,
        );
      }
      const key = keyFor(file.name);
      if (this.filesByName.has(key)) {
        throw new Error(`The selected folder contains more than one file named ${file.name}.`);
      }
      this.filesByName.set(key, file);
    }
  }

  protected async findFile(filename: string): Promise<LocalDataFile | undefined> {
    return this.filesByName.get(keyFor(filename));
  }

  public async listFiles(_path: string): Promise<readonly DataSourceFileInfo[]> {
    return [...this.filesByName.values()].map(({ name, size }) => ({ name, size }));
  }
}

export class DirectoryHandleDataSource extends LocalDataSourceBase {
  public readonly kind = 'directory-handle' as const;
  public readonly label: string;

  public constructor(public readonly handle: FileSystemDirectoryHandleLike) {
    super();
    this.label = `local folder “${handle.name}”`;
  }

  protected async findFile(filename: string): Promise<LocalDataFile | undefined> {
    try {
      return await (await this.handle.getFileHandle(filename)).getFile();
    } catch {
      const wanted = keyFor(filename);
      for await (const entry of this.handle.values()) {
        if (entry.kind === 'file' && keyFor(entry.name) === wanted) {
          return entry.getFile();
        }
      }
      return undefined;
    }
  }

  public async listFiles(_path: string): Promise<readonly DataSourceFileInfo[]> {
    const files: DataSourceFileInfo[] = [];
    for await (const entry of this.handle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        files.push({ name: file.name, size: file.size });
      }
    }
    return files;
  }
}
