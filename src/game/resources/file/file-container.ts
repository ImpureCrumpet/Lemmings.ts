import { LogHandler } from '@/game/utilities/log-handler';
import { BinaryReader } from './binary-reader';
import { UnpackFilePart } from './unpack-file-part';

/** Read the container file and return the unpacked parts of it  */
export class FileContainer {

	private parts: UnpackFilePart[] = [];
	private log: LogHandler = new LogHandler('FileContainer');

	/** read the content of the container  */
	constructor(content: BinaryReader) {
		this.read(content);
	}

	/** Unpack a part (chunks / segments) of the file and return it */
	public getPart(index: number): BinaryReader {
		if ((index < 0) || (index >= this.parts.length)) {
			throw new RangeError(`File part ${index} is out of range (container has ${this.parts.length})`);
		}
		return this.parts[index].unpack();
	}

	/** return the number of parts in this file */
	public count() {
		return this.parts.length;
	}

	/** do the read job and find all parts in this container */
	private read(fileReader: BinaryReader) {
		/// reset parts
		this.parts.length = 0;

		/// we start at the end of the file
		let pos = 0;

		/// the size of the header
		const HEADER_SIZE = 10;

		while (pos < fileReader.length) {
			if (fileReader.length - pos < HEADER_SIZE) {
				if (this.parts.length > 0) {
					break;
				}
				throw new Error(`Truncated container header in ${fileReader.fileName} at offset ${pos}`);
			}

			fileReader.setOffset(pos);

			const part = new UnpackFilePart(fileReader);

			/// start of the chunk
			part.offset = pos + HEADER_SIZE;

			/// Read Header of each Part
			part.initialBufferLen = fileReader.readByte();
			part.checksum = fileReader.readByte();

			part.unknown1 = fileReader.readWord();
			part.decompressedSize = fileReader.readWord();

			part.unknown0 = fileReader.readWord();
			const size = fileReader.readWord();

			part.compressedSize = size - HEADER_SIZE;

			/// position of this part in the container
			part.index = this.parts.length;

			/// check if the data are valid
			if ((part.offset < 0) || (size > 0xFFFFFF) || (size < HEADER_SIZE)) {
				throw new Error(`Invalid part size ${size} in ${fileReader.fileName} at offset ${pos}`);
			}
			if (pos + size > fileReader.length) {
				throw new Error(
					`Truncated part in ${fileReader.fileName} at offset ${pos}: declared ${size} bytes, `
					+ `${fileReader.length - pos} available`,
				);
			}

			//- add part
			this.parts.push(part);

			//this.error.debug(part);

			/// jump to next part
			pos += size;
		}

		this.log.debug(fileReader.fileName + ' has ' + this.parts.length + ' file-parts.');
	}
}
