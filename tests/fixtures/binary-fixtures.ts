export class BinaryFixtureBuilder {
  private readonly data: Uint8Array;

  constructor(length: number, fill = 0) {
    this.data = new Uint8Array(length);
    this.data.fill(fill);
  }

  public byte(offset: number, value: number): this {
    this.data[offset] = value;
    return this;
  }

  public word(offset: number, value: number): this {
    this.data[offset] = (value >>> 8) & 0xff;
    this.data[offset + 1] = value & 0xff;
    return this;
  }

  public int(offset: number, value: number): this {
    this.data[offset] = (value >>> 24) & 0xff;
    this.data[offset + 1] = (value >>> 16) & 0xff;
    this.data[offset + 2] = (value >>> 8) & 0xff;
    this.data[offset + 3] = value & 0xff;
    return this;
  }

  public string(offset: number, value: string, length = value.length): this {
    for (let index = 0; index < length; index++) {
      this.data[offset + index] = index < value.length ? value.charCodeAt(index) : 0x20;
    }
    return this;
  }

  public build(): Uint8Array {
    return this.data.slice();
  }
}

export interface LevelFixtureOptions {
  name?: string;
  releaseRate?: number;
  releaseCount?: number;
  needCount?: number;
  timeLimit?: number;
  screenPositionX?: number;
  graphicSet1?: number;
  graphicSet2?: number;
  superLemming?: boolean;
  skills?: readonly number[];
}

export function buildLevelFixture(options: LevelFixtureOptions = {}): Uint8Array {
  const fixture = new BinaryFixtureBuilder(2048);
  const skills = options.skills ?? [1, 2, 3, 4, 5, 6, 7, 8];

  fixture
    .word(0x00, options.releaseRate ?? 50)
    .word(0x02, options.releaseCount ?? 20)
    .word(0x04, options.needCount ?? 10)
    .word(0x06, options.timeLimit ?? 5);

  skills.forEach((amount, index) => fixture.word(0x08 + index * 2, amount));
  fixture
    .word(0x18, options.screenPositionX ?? 320)
    .word(0x1a, options.graphicSet1 ?? 2)
    .word(0x1c, options.graphicSet2 ?? 0)
    .word(0x1e, options.superLemming ? 1 : 0)
    .string(0x7e0, options.name ?? 'Synthetic reliability level', 32);

  for (let offset = 0x120; offset < 0x760; offset += 4) {
    fixture.int(offset, -1);
  }

  return fixture.build();
}

export function buildOddTableFixture(name = 'Synthetic odd-table entry'): Uint8Array {
  const fixture = new BinaryFixtureBuilder(56);
  const values = [40, 25, 12, 6, 1, 2, 3, 4, 5, 6, 7, 8];
  values.forEach((value, index) => fixture.word(index * 2, value));
  return fixture.string(24, name, 32).build();
}

/** Build a single-part DAT container using the format's short raw-copy command. */
export function buildRawContainer(payload: Uint8Array): Uint8Array {
  if (payload.length < 1 || payload.length > 8) {
    throw new RangeError('Raw container fixtures support payloads from 1 to 8 bytes');
  }

  const bits: number[] = [0, 0];
  pushBits(bits, payload.length - 1, 3);
  for (let index = payload.length - 1; index >= 0; index--) {
    pushBits(bits, payload[index], 8);
  }

  const compressed = packReverseBitStream(bits);
  const checksum = compressed.reduce((value, byte) => value ^ byte, 0);
  const fixture = new BinaryFixtureBuilder(10 + compressed.length)
    .byte(0, bits.length % 8 || 8)
    .byte(1, checksum)
    .word(4, payload.length)
    .word(8, 10 + compressed.length)
    .build();
  fixture.set(compressed, 10);
  return fixture;
}

function pushBits(target: number[], value: number, count: number): void {
  for (let bit = count - 1; bit >= 0; bit--) {
    target.push((value >>> bit) & 1);
  }
}

function packReverseBitStream(bits: readonly number[]): Uint8Array {
  const firstChunkLength = bits.length % 8 || 8;
  const chunks: number[] = [];
  let bitIndex = 0;
  let chunkLength = firstChunkLength;

  while (bitIndex < bits.length) {
    let byte = 0;
    for (let index = 0; index < chunkLength; index++) {
      byte |= bits[bitIndex++] << index;
    }
    chunks.push(byte);
    chunkLength = 8;
  }

  return Uint8Array.from(chunks.reverse());
}
