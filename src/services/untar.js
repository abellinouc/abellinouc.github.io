/**
 * The smallest tar reader that will do.
 *
 * The bundler hands back a plain uncompressed tar, and every library that reads
 * one wants to be a dependency, a build step and a licence. A tar is 512-byte
 * headers with the file laid out after each, padded to 512 — a hundred lines,
 * and a hundred lines that cannot go out of date.
 *
 * It reads the fields it needs and no others: the name and the size. Ownership,
 * times and modes are what the archive carries about a Linux box that has
 * nothing to do with a cache entry in a phone.
 */

const BLOCK = 512;

function str(buf, off, len) {
  let end = off;
  const limit = off + len;
  while (end < limit && buf[end] !== 0) end++;
  return new TextDecoder().decode(buf.subarray(off, end));
}

function octal(buf, off, len) {
  const s = str(buf, off, len).trim();
  if (!s) return 0;
  return parseInt(s, 8) || 0;
}

/**
 * Walks a tar and calls back once per file, with the bytes as a view INTO the
 * original buffer rather than a copy: a Norder8 chunk is 46 MB and copying every
 * tile out of it again would double the peak for nothing.
 *
 * Skips the pax/global headers GNU tar puts in ('x', 'g') and anything that is
 * not a plain file, so a directory entry cannot end up cached as a tile.
 */
export function untar(buffer, onFile) {
  const buf = new Uint8Array(buffer);
  let off = 0;
  let n = 0;

  while (off + BLOCK <= buf.length) {
    // two zero blocks end the archive; one is enough to know we are past the end
    if (buf[off] === 0 && buf[off + 1] === 0 && buf[off + 2] === 0) break;

    const name = str(buf, off, 100);
    const size = octal(buf, off + 124, 12);
    const type = String.fromCharCode(buf[off + 156] || 48);
    off += BLOCK;

    const end = off + size;
    if (end > buf.length) break;              // truncated: stop, do not guess

    if (name && (type === "0" || type === "\0" || type === "48")) {
      onFile(name, buf.subarray(off, end));
      n++;
    }

    off = end + ((BLOCK - (size % BLOCK)) % BLOCK);
  }
  return n;
}
