import { LogHandler } from '@/game/utilities/log-handler';
import { Frame } from '../frame';
import { BinaryReader } from './binary-reader';

/**
* Handle Files loading from remote/web
*/
export class FileProvider {

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
      throw new Error(`Unable to load ${url}: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
      throw new Error(`Game data file not found: ${url}`);
    }

    return new BinaryReader(
      await response.arrayBuffer(),
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
      throw new Error(`Unable to load ${url}: ${response.status} ${response.statusText}`);
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
      throw new Error(`Unable to load ${url}: ${response.status} ${response.statusText}`);
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
