import type { Frame } from '../frame';
import type { BinaryReader } from './binary-reader';

export type DataSourceKind = 'http' | 'local-files' | 'directory-handle' | 'memory';
export type DataSourceErrorCode = 'missing' | 'unreadable' | 'html-fallback';

export interface DataSourceFileInfo {
  name: string;
  size: number;
}

export interface ResourceDataSource {
  readonly kind: DataSourceKind;
  readonly label: string;

  loadBinary(path: string, filename?: string): Promise<BinaryReader>;
  loadString(path: string, filename?: string): Promise<string>;
  loadOptionalImage(path: string, filename: string): Promise<Frame | undefined>;
  listFiles?(path: string): Promise<readonly DataSourceFileInfo[]>;
}

export interface ResourceDataSourceResolver {
  resolve(editionPath: string): ResourceDataSource;
}

export function isHtmlDocument(data: ArrayBuffer): boolean {
  const prefix = new TextDecoder().decode(data.slice(0, 256)).trimStart().toLowerCase();
  return prefix.startsWith('<!doctype html') || prefix.startsWith('<html');
}

export class DataSourceError extends Error {
  public constructor(
    public readonly code: DataSourceErrorCode,
    public readonly filename: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'DataSourceError';
  }
}
