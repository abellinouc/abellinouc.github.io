/**
 * The list of everything the app needs to START, written from the build that
 * was actually produced.
 *
 * The service worker used to seed a hand-written handful and pick up the rest
 * "on the first online visit". That is fine until the worker is replaced: the
 * new SHELL cache is created empty, the old one is deleted on activation, and
 * the hashed bundles are in neither. Open the app offline in that window and it
 * is a white page - the document loads and the module it names is nowhere.
 *
 * Generated rather than maintained, because a list of fingerprinted filenames
 * that somebody has to remember to update is a list that will be wrong.
 */
import { readdir, writeFile, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const DIST = "dist";
const SKIP = new Set(["sw.js", "precache.json"]);

async function walk(dir, base = "") {
  const out = [];
  for (const name of await readdir(dir)) {
    const rel = base ? `${base}/${name}` : name;
    if (SKIP.has(rel)) continue;
    const s = await stat(join(dir, name));
    if (s.isDirectory()) out.push(...(await walk(join(dir, name), rel)));
    else out.push({ url: `./${rel}`, bytes: s.size });
  }
  return out;
}

const files = await walk(DIST);
files.sort((a, b) => a.url.localeCompare(b.url));
const total = files.reduce((n, f) => n + f.bytes, 0);

await writeFile(
  join(DIST, "precache.json"),
  JSON.stringify({ files: files.map((f) => f.url) }, null, 2) + "\n"
);

/**
 * Stamp the worker with what this build contains.
 *
 * A service worker is only reinstalled when its own bytes change. Ship a new
 * app build without touching sw.js and the browser sees the same worker, skips
 * install, and never precaches the bundles this build actually names - which is
 * the whole point of having a list. One line of build identity fixes it: every
 * build produces a different worker, so every build reinstalls and takes its own
 * files with it.
 *
 * The cache NAME is untouched, so this adds to the existing shell rather than
 * replacing it, and nothing is deleted on the way through.
 */
const stamp = createHash("sha256")
  .update(files.map((f) => f.url).join("|"))
  .digest("hex")
  .slice(0, 12);

const swPath = join(DIST, "sw.js");
const sw = await readFile(swPath, "utf8");
await writeFile(swPath, sw + "\n// build: " + stamp + "\n");

console.log(
  `precache.json: ${files.length} files, ${(total / 1048576).toFixed(1)} MB — sw build ${stamp}`
);
