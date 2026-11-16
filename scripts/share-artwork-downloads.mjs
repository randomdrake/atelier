import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const localFile = 0x04034b50;
const centralDirectory = 0x02014b50;

async function readStoredPart(archive, images, staging) {
  const members = [];
  let offset = 0;
  while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === localFile) {
    const flags = archive.readUInt16LE(offset + 6);
    const compression = archive.readUInt16LE(offset + 8);
    const size = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    const end = start + size;
    if ((flags & 8) || compression !== 0 || end > archive.length) return null;
    const name = archive.toString('utf8', offset + 30, offset + 30 + nameLength);
    const image = images.get(name);
    if (!image || !archive.subarray(start, end).equals(await readFile(join(staging, image)))) return null;
    members.push({ name, image, size, header: archive.subarray(offset, start).toString('base64') });
    offset = end;
  }
  if (!members.length || offset + 4 > archive.length || archive.readUInt32LE(offset) !== centralDirectory) return null;
  return {
    members,
    directory: archive.subarray(offset).toString('base64'),
    size: archive.length,
    digest: createHash('sha256').update(archive).digest('hex')
  };
}

// Keep parts with distinct source artwork as ordinary static downloads. For
// matching parts the Worker needs only ZIP metadata and the existing PNGs.
export async function shareArtworkDownloads({ root, staging }) {
  const downloads = JSON.parse(await readFile(join(staging, 'source-downloads.json'), 'utf8'));
  const catalog = JSON.parse(await readFile(join(staging, 'catalog.json'), 'utf8'));
  const images = new Map(catalog.flatMap(({ id, image }) => [
    [`examples/previews/${id}.png`, image],
    ['public-gallery' + image, image]
  ]));
  const parts = {};
  for (const name of downloads.filter(name => name.startsWith('source-artwork-'))) {
    const path = join(staging, name);
    const part = await readStoredPart(await readFile(path), images, staging);
    if (!part) continue;
    parts['/' + name] = part;
    await rm(path);
  }
  const module = join(root, 'hosting/generated/artwork-downloads.js');
  await mkdir(dirname(module), { recursive: true });
  await writeFile(module, 'export default ' + JSON.stringify(parts) + ';\n');
}
