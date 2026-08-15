import { GameTypes } from '@/game/game-types';

export type DataFileStructure = 'container' | 'raw';

export interface DataFileRequirement {
  readonly name: string;
  readonly minBytes: number;
  readonly maxBytes: number;
  readonly structure: DataFileStructure;
}

export interface EditionManifest {
  readonly gameType: GameTypes;
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly required: readonly DataFileRequirement[];
  readonly optional: readonly string[];
}

function file(name: string, bytes: number, structure: DataFileStructure = 'container'):
DataFileRequirement {
  return { name, minBytes: bytes, maxBytes: bytes, structure };
}

function numbered(
  prefix: string,
  sizes: readonly number[],
  start = 0,
): DataFileRequirement[] {
  return sizes.map((bytes, index) => file(
    `${prefix}${String(index + start).padStart(3, '0')}.DAT`,
    bytes,
  ));
}

const standard: EditionManifest = {
  gameType: GameTypes.LEMMINGS,
  id: 'lemmings',
  name: 'Lemmings',
  path: 'lemmings',
  required: [
    file('ADLIB.DAT', 12_988),
    ...[1_056, 1_056, 1_056, 1_056, 1_056]
      .map((bytes, index) => file(`GROUND${index}O.DAT`, bytes, 'raw')),
    ...numbered('LEVEL', [3_722, 4_519, 4_819, 6_827, 3_889, 7_255, 7_149, 5_253, 7_037, 4_932]),
    file('MAIN.DAT', 56_472),
    file('ODDTABLE.DAT', 4_480, 'raw'),
    ...[24_464, 32_966, 22_290, 22_775, 28_692]
      .map((bytes, index) => file(`VGAGR${index}.DAT`, bytes)),
    ...[28_655, 18_567, 23_284, 34_827]
      .map((bytes, index) => file(`VGASPEC${index}.DAT`, bytes, 'raw')),
  ],
  optional: ['README.md', 'toolbar.png'],
};

const ohNo: EditionManifest = {
  gameType: GameTypes.OHNO,
  id: 'ohno',
  name: 'Oh No! More Lemmings',
  path: 'lemmings_ohNo',
  required: [
    file('ADLIB.DAT', 6_894),
    ...numbered('DLVEL', [
      3_295, 3_320, 3_607, 5_625, 7_868, 5_163, 3_776,
      4_407, 5_894, 4_365, 3_366, 4_299, 1_742,
    ]),
    ...[1_056, 1_056, 1_056, 1_056]
      .map((bytes, index) => file(`GROUND${index}O.DAT`, bytes, 'raw')),
    file('MAIN.DAT', 112_780),
    ...[18_104, 25_902, 32_778, 20_298]
      .map((bytes, index) => file(`VGAGR${index}.DAT`, bytes)),
  ],
  optional: ['README.md', 'TGAMAIN.DAT', 'toolbar.png'],
};

const xmas91: EditionManifest = {
  gameType: GameTypes.XMAS91,
  id: 'xmas91',
  name: 'Xmas Lemmings 1991',
  path: 'lemmings_X-Mas91',
  required: [
    file('ADLIB.DAT', 3_597),
    file('GROUND0O.DAT', 1_056, 'raw'),
    file('GROUND2O.DAT', 1_056, 'raw'),
    file('LEVEL000.DAT', 2_552),
    file('MAIN.DAT', 59_992),
    file('VGAGR0.DAT', 17_957),
    file('VGAGR2.DAT', 33_123),
  ],
  optional: ['LEMMINGS.BAT', 'README.md', 'TGAMAIN.DAT', 'toolbar.png'],
};

const xmas92: EditionManifest = {
  gameType: GameTypes.XMAS92,
  id: 'xmas92',
  name: 'Xmas Lemmings 1992',
  path: 'lemmings_X-Mas92',
  required: [
    file('ADLIB.DAT', 3_597),
    file('GROUND2O.DAT', 1_056, 'raw'),
    file('LEVEL000.DAT', 2_201),
    file('MAIN.DAT', 59_992),
    file('VGAGR2.DAT', 33_123),
  ],
  optional: ['README.md', 'TANDYSND.DAT', 'toolbar.png'],
};

const holiday93: EditionManifest = {
  gameType: GameTypes.HOLIDAY93,
  id: 'holiday93',
  name: 'Holiday Lemmings 1993',
  path: 'lemmings_Holiday93',
  required: [
    file('ADLIB.DAT', 3_597),
    file('GROUND1O.DAT', 1_056, 'raw'),
    file('GROUND2O.DAT', 1_056, 'raw'),
    ...numbered('LEVEL', [3_143, 2_868, 3_033, 5_654]),
    file('MAIN.DAT', 59_775),
    file('VGAGR1.DAT', 25_902),
    file('VGAGR2.DAT', 33_123),
  ],
  optional: ['GREET.DAT', 'INSTALL.EXE', 'README.md', 'toolbar.png'],
};

const holiday94: EditionManifest = {
  gameType: GameTypes.HOLIDAY94,
  id: 'holiday94',
  name: 'Holiday Lemmings 1994',
  path: 'lemmings_Holiday94',
  required: [
    file('ADLIB.DAT', 6_894),
    file('GROUND1O.DAT', 1_056, 'raw'),
    file('GROUND2O.DAT', 1_056, 'raw'),
    ...numbered('LEVEL', [2_432, 2_633, 3_433, 3_401, 3_143, 2_868, 3_033, 5_654]),
    file('MAIN.DAT', 58_577),
    file('VGAGR1.DAT', 25_902),
    file('VGAGR2.DAT', 33_123),
  ],
  optional: ['GREET.DAT', 'README.md', 'toolbar.png'],
};

export const EDITION_MANIFESTS: readonly EditionManifest[] = [
  standard,
  ohNo,
  xmas91,
  xmas92,
  holiday93,
  holiday94,
];

export function getEditionManifest(gameType: GameTypes): EditionManifest | undefined {
  return EDITION_MANIFESTS.find((manifest) => manifest.gameType === gameType);
}
