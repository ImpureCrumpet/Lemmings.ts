/** Provides bounds-checked, cursor-based access to binary game data. */
export class BinaryReader {
  public readonly fileName: string;
  public readonly length: number;
  public pos: number;

  protected readonly data: Uint8Array;
  protected readonly hiddenOffset: number;

  constructor(
    dataArray?: BinaryReader | Uint8Array | ArrayBuffer | Blob,
    offset: number | null = null,
    length: number | null = null,
    filename = '[unknown]',
  ) {
    let resolvedFileName = filename;
    let data: Uint8Array;
    let baseOffset = 0;
    let availableLength: number;

    if (dataArray == null) {
      data = new Uint8Array(0);
      availableLength = 0;
    } else if (dataArray instanceof BinaryReader) {
      data = dataArray.data;
      baseOffset = dataArray.hiddenOffset;
      availableLength = dataArray.length;
      if (filename === '[unknown]') {
        resolvedFileName = dataArray.fileName;
      }
    } else if (dataArray instanceof Uint8Array) {
      data = dataArray;
      availableLength = data.byteLength;
    } else if (dataArray instanceof ArrayBuffer) {
      data = new Uint8Array(dataArray);
      availableLength = data.byteLength;
    } else {
      throw new TypeError('BinaryReader does not support Blob input; convert it to an ArrayBuffer first.');
    }

    this.fileName = resolvedFileName;
    const relativeOffset = offset ?? 0;
    const viewLength = length ?? availableLength - relativeOffset;

    if (!Number.isInteger(relativeOffset) || relativeOffset < 0 || relativeOffset > availableLength) {
      throw new RangeError(`Invalid offset ${relativeOffset} for ${this.fileName} (${availableLength} bytes)`);
    }
    if (!Number.isInteger(viewLength) || viewLength < 0 || relativeOffset + viewLength > availableLength) {
      throw new RangeError(
        `Invalid length ${viewLength} at offset ${relativeOffset} for ${this.fileName} (${availableLength} bytes)`,
      );
    }

    this.data = data;
    this.hiddenOffset = baseOffset + relativeOffset;
    this.length = viewLength;
    this.pos = this.hiddenOffset;
  }

  /** Read one byte from the stream. */
  public readByte(offset?: number): number {
    if (offset != null) {
      this.setOffset(offset);
    }

    this.assertAvailable(1);
    const value = this.data[this.pos];
    this.pos++;
    return value;
  }

  /** Read an integer in the file formats' default byte order (most significant byte first). */
  public readInt(length = 4, offset = -1): number {
    this.assertIntegerLength(length);
    if (offset >= 0) {
      this.setOffset(offset);
    }
    this.assertAvailable(length);

    let value = 0;
    for (let index = 0; index < length; index++) {
      value = (value << 8) | this.data[this.pos++];
    }
    return value;
  }

  /** Read a four-byte integer with the least significant byte first. */
  public readIntBE(offset?: number): number {
    if (offset != null) {
      this.setOffset(offset);
    }
    this.assertAvailable(4);

    const value = this.data[this.pos]
      | (this.data[this.pos + 1] << 8)
      | (this.data[this.pos + 2] << 16)
      | (this.data[this.pos + 3] << 24);
    this.pos += 4;
    return value;
  }

  /** Read a two-byte word with the most significant byte first. */
  public readWord(offset = -1): number {
    if (offset >= 0) {
      this.setOffset(offset);
    }
    this.assertAvailable(2);

    const value = (this.data[this.pos] << 8) | this.data[this.pos + 1];
    this.pos += 2;
    return value;
  }

  /** Read a two-byte word with the least significant byte first. */
  public readWordBE(offset = -1): number {
    if (offset >= 0) {
      this.setOffset(offset);
    }
    this.assertAvailable(2);

    const value = this.data[this.pos] | (this.data[this.pos + 1] << 8);
    this.pos += 2;
    return value;
  }

  /** Read a fixed-length byte string. */
  public readString(length: number, offset = -1): string {
    if (!Number.isInteger(length) || length < 0) {
      throw new RangeError(`Invalid string length ${length} for ${this.fileName}`);
    }
    if (offset >= 0) {
      this.setOffset(offset);
    }
    this.assertAvailable(length);

    let result = '';
    const end = this.pos + length;
    while (this.pos < end) {
      result += String.fromCharCode(this.data[this.pos++]);
    }
    return result;
  }

  /** Return the current cursor position relative to this reader's view. */
  public getOffset(): number {
    return this.pos - this.hiddenOffset;
  }

  /** Set the current cursor position relative to this reader's view. */
  public setOffset(newPos: number): void {
    if (!Number.isInteger(newPos) || newPos < 0 || newPos > this.length) {
      throw new RangeError(`Invalid offset ${newPos} for ${this.fileName} (${this.length} bytes)`);
    }
    this.pos = newPos + this.hiddenOffset;
  }

  /** Return true when the cursor is at the end of this reader's view. */
  public eof(): boolean {
    const position = this.getOffset();
    return position >= this.length || position < 0;
  }

  /** Return the whole view as a byte string. */
  public readAll(): string {
    return this.readString(this.length, 0);
  }

  /** Return an independent copy of this reader's visible byte range. */
  public toUint8Array(): Uint8Array {
    return this.data.slice(this.hiddenOffset, this.hiddenOffset + this.length);
  }

  private assertAvailable(byteCount: number): void {
    const position = this.getOffset();
    if (position < 0 || position + byteCount > this.length) {
      throw new RangeError(
        `Unexpected end of ${this.fileName}: requested ${byteCount} byte(s) at ${position}, length is ${this.length}`,
      );
    }
  }

  private assertIntegerLength(length: number): void {
    if (!Number.isInteger(length) || length < 1 || length > 4) {
      throw new RangeError(`Integer length must be between 1 and 4 bytes; received ${length}`);
    }
  }
}
