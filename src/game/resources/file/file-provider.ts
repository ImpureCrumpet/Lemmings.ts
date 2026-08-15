import { LogHandler } from '@/game/utilities/log-handler';
import { Frame } from '../frame';
import { BinaryReader } from './binary-reader';
import {
  DataSourceError,
  isHtmlDocument,
  type ResourceDataSource,
} from './resource-data-source';

/**
* Handle Files loading from remote/web
*/
export class FileProvider implements ResourceDataSource {

  public readonly kind = 'http' as const;
  public readonly label = 'static data folder';

  private log: LogHandler = new LogHandler('FileProvider');


  constructor(private rootPath: string) {

  }

  private createFullUrl(path: string, fileName?: string) {

    return this.rootPath + (path ? '/' + path : '') + (fileName ? '/' + fileName : '');
  }


  /** load binary data from URL: rootPath + [path] + filename */
  public async loadBinary(path: string, filename?: string): Promise<BinaryReader> {

    const url = this.createFullUrl(path, filename);

    this.log.debug('loading:' + url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new DataSourceError(
        response.status === 404 ? 'missing' : 'unreadable',
        filename ?? this.fileNameFormUrl(url),
        response.status === 404
          ? `${filename ?? this.fileNameFormUrl(url)} is missing from the static data folder.`
          : `Unable to read ${filename ?? this.fileNameFormUrl(url)} (${response.status} ${response.statusText}).`,
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
      throw new DataSourceError(
        'html-fallback',
        filename ?? this.fileNameFormUrl(url),
        `${filename ?? this.fileNameFormUrl(url)} returned a web page instead of game data.`,
      );
    }

    const data = await response.arrayBuffer();
    if (isHtmlDocument(data)) {
      throw new DataSourceError(
        'html-fallback',
        filename ?? this.fileNameFormUrl(url),
        `${filename ?? this.fileNameFormUrl(url)} returned a web page instead of game data.`,
      );
    }

    return new BinaryReader(
      data,
      0,
      null,
      this.fileNameFormUrl(url),
    );
  }


  /** load string data from URL */
  public async loadString(path: string, filename?: string): Promise<string> {

    const url = this.createFullUrl(path, filename);

    this.log.log('Load file as string: ' + url);

    const response = await fetch(url);
    if (!response.ok) {
      throw new DataSourceError(
        response.status === 404 ? 'missing' : 'unreadable',
        filename ?? this.fileNameFormUrl(url),
        `Unable to read ${filename ?? this.fileNameFormUrl(url)} (${response.status} ${response.statusText}).`,
      );
    }

    return response.text();
  }

  /** Load an optional browser image. Missing files return undefined. */
  public async loadOptionalImage(path: string, filename: string): Promise<Frame | undefined> {
    const url = this.createFullUrl(path, filename);
    const response = await fetch(url);

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      throw new DataSourceError(
        'unreadable',
        filename,
        `Unable to read ${filename} (${response.status} ${response.statusText}).`,
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      return undefined;
    }

    const bitmap = await createImageBitmap(await response.blob());
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error(`Unable to decode ${url}`);
      }

      context.drawImage(bitmap, 0, 0);
      return Frame.fromImageData(context.getImageData(0, 0, bitmap.width, bitmap.height));
    } finally {
      bitmap.close();
    }
  }


  // Extract filename form URL
  private fileNameFormUrl(url: string): string {
    if (url === '') return '';

    url = url.substring(0, (url.indexOf('#') === -1) ? url.length : url.indexOf('#'));
    url = url.substring(0, (url.indexOf('?') === -1) ? url.length : url.indexOf('?'));
    url = url.substring(url.lastIndexOf('/') + 1, url.length);

    return url;
  }

}
