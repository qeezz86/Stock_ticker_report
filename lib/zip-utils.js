import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

export function unzipSingleFile(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdOffset = findSignature(bytes, EOCD_SIGNATURE);
  if (eocdOffset < 0) {
    throw new Error("ZIP end-of-central-directory record not found.");
  }

  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const firstEntryOffset = centralDirectoryOffset;
  if (view.getUint32(firstEntryOffset, true) !== CENTRAL_DIRECTORY_SIGNATURE) {
    throw new Error("ZIP central directory entry not found.");
  }

  const compressionMethod = view.getUint16(firstEntryOffset + 10, true);
  const compressedSize = view.getUint32(firstEntryOffset + 20, true);
  const localFileOffset = view.getUint32(firstEntryOffset + 42, true);

  if (view.getUint32(localFileOffset, true) !== LOCAL_FILE_SIGNATURE) {
    throw new Error("ZIP local file header not found.");
  }

  const localNameLength = view.getUint16(localFileOffset + 26, true);
  const localExtraLength = view.getUint16(localFileOffset + 28, true);
  const dataOffset = localFileOffset + 30 + localNameLength + localExtraLength;
  const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);

  if (compressionMethod === 0) {
    return compressed;
  }

  if (compressionMethod === 8) {
    return inflateRawSync(compressed);
  }

  throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
}

function findSignature(bytes, signature) {
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (
      bytes[index] === (signature & 0xff) &&
      bytes[index + 1] === ((signature >> 8) & 0xff) &&
      bytes[index + 2] === ((signature >> 16) & 0xff) &&
      bytes[index + 3] === ((signature >> 24) & 0xff)
    ) {
      return index;
    }
  }
  return -1;
}
