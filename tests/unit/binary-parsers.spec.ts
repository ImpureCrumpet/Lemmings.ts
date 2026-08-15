import { describe, expect, it } from 'vitest';
import { BinaryReader } from '@/game/resources/file/binary-reader';
import { FileContainer } from '@/game/resources/file/file-container';
import { buildRawContainer } from '../fixtures/binary-fixtures';

describe('BinaryReader', () => {
  it('reads sequential values and both byte orders', () => {
    const reader = new BinaryReader(
      Uint8Array.from([0x12, 0x34, 0x78, 0x56, 0x41, 0x42]),
      null,
      null,
      'values.dat',
    );

    expect(reader.readWord()).toBe(0x1234);
    expect(reader.readWordBE()).toBe(0x5678);
    expect(reader.readString(2)).toBe('AB');
    expect(reader.eof()).toBe(true);
  });

  it('keeps nested readers inside their parent view', () => {
    const root = new BinaryReader(Uint8Array.from([0, 1, 2, 3, 4]), 1, 3, 'slice.dat');
    const nested = new BinaryReader(root, 1, 2);

    expect(nested.fileName).toBe('slice.dat');
    expect(nested.readByte()).toBe(2);
    expect(nested.readByte()).toBe(3);
    expect(() => nested.readByte()).toThrow(/Unexpected end of slice\.dat/);
    expect(() => new BinaryReader(root, 2, 2)).toThrow(/Invalid length/);
  });

  it('rejects invalid offsets, lengths, and truncated reads', () => {
    const reader = new BinaryReader(Uint8Array.from([1]), null, null, 'tiny.dat');

    expect(() => reader.setOffset(-1)).toThrow(/Invalid offset/);
    expect(() => reader.readWord()).toThrow(/requested 2 byte\(s\) at 0/);
    expect(() => reader.readInt(0)).toThrow(/between 1 and 4/);
    expect(() => reader.readString(-1)).toThrow(/Invalid string length/);
  });
});

describe('FileContainer', () => {
  it('unpacks a valid synthetic part and returns independent cursors', () => {
    const container = new FileContainer(
      new BinaryReader(buildRawContainer(Uint8Array.from([0x41, 0x42])), null, null, 'fixture.dat'),
    );

    expect(container.count()).toBe(1);
    const first = container.getPart(0);
    expect(first.readAll()).toBe('AB');
    expect(container.getPart(0).getOffset()).toBe(0);
  });

  it('rejects truncated headers and payloads', () => {
    expect(() => new FileContainer(new BinaryReader(new Uint8Array(9), null, null, 'header.dat')))
      .toThrow(/Truncated container header/);

    const truncatedPart = new Uint8Array(10);
    truncatedPart[8] = 0;
    truncatedPart[9] = 12;
    expect(() => new FileContainer(new BinaryReader(truncatedPart, null, null, 'part.dat')))
      .toThrow(/Truncated part/);
  });

  it('ignores a short trailing remainder after a valid part', () => {
    const part = buildRawContainer(Uint8Array.from([0x41]));

    for (let paddingLength = 1; paddingLength < 10; paddingLength++) {
      const padded = new Uint8Array(part.length + paddingLength);
      padded.set(part);
      padded.fill(0xff, part.length);

      const container = new FileContainer(
        new BinaryReader(padded, null, null, `padding-${paddingLength}.dat`),
      );
      expect(container.count()).toBe(1);
      expect(container.getPart(0).readAll()).toBe('A');
    }
  });

  it('rejects invalid part indexes and checksum mismatches', () => {
    const bytes = buildRawContainer(Uint8Array.from([0x41]));
    const container = new FileContainer(new BinaryReader(bytes, null, null, 'fixture.dat'));
    expect(() => container.getPart(1)).toThrow(/out of range/);

    bytes[1] ^= 0xff;
    const corrupt = new FileContainer(new BinaryReader(bytes, null, null, 'corrupt.dat'));
    expect(() => corrupt.getPart(0)).toThrow(/Checksum mismatch in corrupt\.dat/);
  });
});
