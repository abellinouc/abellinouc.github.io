/**
 * Putting the sky on the phone.
 *
 * Two shapes of source, for one reason: how many files they are.
 *
 *   "files"  - smalldata. 7,985 objects, 178 MB, on a host that serves them one
 *              at a time. Fetched one at a time, a dozen at once. Minutes.
 *
 *   "bundle" - the surveys. Norder8 alone is 786,423 tiles, and asking for them
 *              one at a time is three-quarters of a million round trips before a
 *              byte of it is useful. They come through the bundler on the server,
 *              a couple of thousand tiles to a tar, and are unpacked here.
 *
 * Everything is resumable, because a 27 GB download over a phone connection WILL
 * be interrupted - that is not a failure case, it is the normal case. Progress is
 * written after every chunk, so the worst an interruption costs is the chunk that
 * was in flight.
 *
 * A 404 is not an error. These surveys have holes and the missing tiles are
 * simply not there; a downloader that treated them as failures would report a
 * broken download every single time.
 */

import { untar } from "./untar.js";
import { TILES_PER_CHUNK, DSS_PROPERTIES } from "./offlineCatalog.js";

const DATA_CACHE = "vc-data-v1";
const STATE_KEY = "vc-offline-state-v1";

// How many fetches one file-by-file source keeps in the air. Chrome gives six
// connections per origin over HTTP/1.1 and multiplexes over HTTP/2; twelve keeps
// the pipe full without the queue becoming the bottleneck.
const FILE_CONCURRENCY = 12;

/**
 * A ceiling on requests in flight ACROSS every download at once.
 *
 * The panel now runs sources one at a time - press as many as you like and they
 * form a queue - so in normal use only one source is drawing on this. It stays
 * because the ceiling is the downloader's own promise rather than the panel's:
 * whatever calls it, the network sees a steady sixteen.
 */
const GLOBAL_INFLIGHT = 16;

let inFlight = 0;
const waiting = [];

function acquire() {
  if (inFlight < GLOBAL_INFLIGHT) {
    inFlight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else inFlight--;
}

/**
 * fetch(), but only when there is a lane free - and never for ever.
 *
 * A phone loses a connection without closing it: the request simply stops, and
 * a fetch with no timeout waits for a socket that will never answer. One of
 * those holds a lane; sixteen of them hold every lane, and the whole panel sits
 * at "Conectando" with nothing to show and nothing to blame. So each attempt has
 * a deadline, and a deadline that expires is an error like any other - reported,
 * retried, visible.
 */
async function limitedFetch(url, init, timeoutMs) {
  await acquire();
  const guard = new AbortController();
  const outer = init && init.signal;
  const onOuter = () => guard.abort();
  if (outer) {
    if (outer.aborted) guard.abort();
    else outer.addEventListener("abort", onOuter, { once: true });
  }
  const ms = timeoutMs || 45000;
  let timer = null;

  // A RACE, not just an abort.
  //
  // Aborting the signal only helps if whatever is on the other end honours it,
  // and the case worth defending against is exactly the one that does not answer
  // at all. Racing the fetch against a timer means the deadline holds whatever
  // the network does - the abort is still sent, to free the socket, but nothing
  // depends on it being noticed.
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      guard.abort();
      reject(new Error("sin respuesta tras " + Math.round(ms / 1000) + " s"));
    }, ms);
  });

  try {
    return await Promise.race([
      fetch(url, { ...(init || {}), signal: guard.signal }),
      deadline,
    ]);
  } catch (e) {
    if (outer && outer.aborted) throw e;               // the user pressed Detener
    throw e;
  } finally {
    clearTimeout(timer);
    if (outer) outer.removeEventListener("abort", onOuter);
    release();
  }
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

function saveState(s) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch (e) {
    /* the quota for localStorage is not the quota that matters here */
  }
}

export function getProgress(id) {
  return loadState()[id] || { bytes: 0, files: 0, chunk: 0, done: false };
}

function setProgress(id, p) {
  const s = loadState();
  s[id] = p;
  saveState(s);
}

export function clearProgress(id) {
  const s = loadState();
  delete s[id];
  saveState(s);
}

/**
 * What the browser will let us keep, and what is already kept.
 *
 * The quota is not the phone free space: Chrome offers roughly 60% of what is
 * free on the volume, and it shrinks as the phone fills up. Reported as it comes
 * so the panel can say plainly how much room there really is.
 */
export async function storageInfo() {
  if (!navigator.storage || !navigator.storage.estimate) {
    return { quota: null, usage: null, persisted: false, supported: false };
  }
  const est = await navigator.storage.estimate();
  let persisted = false;
  try {
    persisted = await navigator.storage.persisted();
  } catch (e) {}
  return {
    quota: est.quota == null ? null : est.quota,
    usage: est.usage == null ? null : est.usage,
    persisted,
    supported: true,
  };
}

/**
 * Ask the browser not to evict this. Without it a phone under storage pressure
 * is free to throw away 27 GB the user waited an hour for, silently.
 */
export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch (e) {}
  return false;
}

function dirOf(npix) {
  return Math.floor(npix / 10000) * 10000;
}

function tileUrl(source, npix, ext) {
  return (
    source.host + "surveys/" + source.survey + "/" + source.version +
    "/Norder" + source.order + "/Dir" + dirOf(npix) + "/Npix" + npix + "." + ext
  );
}

/**
 * Read a response body, telling the caller how far along it is.
 *
 * Falls back to arrayBuffer() where streams are not available - older WebViews -
 * so the download still works, it just goes quiet for the length of a chunk.
 */
async function readWithProgress(res, base, onTick, files) {
  if (!res.body || !res.body.getReader) return await res.arrayBuffer();

  const reader = res.body.getReader();
  const parts = [];
  let got = 0;
  for (;;) {
    // The deadline on the request only covers the HEADERS: fetch resolves the
    // moment they arrive, and a body that then stops half way through its 46 MB
    // would hang here with nothing watching. Each read gets its own deadline
    // instead - a stall of three quarters of a minute between packets is a dead
    // connection, not a slow one.
    let chunk;
    try {
      chunk = await withDeadline(reader.read(), 45000, "la descarga");
    } catch (e) {
      try {
        await reader.cancel();
      } catch (_) {}
      throw e;
    }
    if (chunk.done) break;
    parts.push(chunk.value);
    got += chunk.value.byteLength;
    onTick(base + got, files);
  }

  const out = new Uint8Array(got);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out.buffer;
}

async function putBytes(cache, url, bytes, type) {
  await cache.put(
    url,
    new Response(bytes, {
      headers: {
        "Content-Type": type,
        "Content-Length": String(bytes.byteLength),
      },
    })
  );
}

/**
 * Nothing in a download is allowed to wait for ever - and the network is not the
 * only thing that can go quiet. Cache Storage is a real database on a real
 * phone: under storage pressure, or while another tab holds it, opening it or
 * writing to it can sit there indefinitely. A deadline on fetch alone would
 * leave that case looking exactly like the one it was written to cure - a row
 * that says "Conectando..." for ever - so the cache calls get one too.
 */
function withDeadline(promise, ms, what) {
  let timer = null;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(what + " no responde tras " + Math.round(ms / 1000) + " s")),
      ms
    );
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

/**
 * One source, start to finish. onTick is called with (bytes, files) done so far;
 * signal aborts it. Returns when the source is complete or aborted.
 */
export async function download(source, opts) {
  const onTick = (opts && opts.onTick) || function () {};
  const onNote = (opts && opts.onNote) || function () {};
  const signal = opts && opts.signal;
  const cache = await withDeadline(caches.open(DATA_CACHE), 15000, "el almacen");
  const p = getProgress(source.id);
  let bytes = p.bytes || 0;
  let files = p.files || 0;

  const stopped = () => signal && signal.aborted;

  if (source.kind === "files") {
    // A resume walks the WHOLE list again, from zero.
    //
    // The index that was being recorded is how far the workers had been
    // DISPATCHED, not how far they had finished: twelve are in flight at any
    // moment, so resuming from it stepped over up to twelve files that never
    // landed. They would simply have been missing from the sky, with nothing
    // saying so.
    //
    // Walking from zero settles it, and costs almost nothing: a file already in
    // the cache is answered by a cache lookup and never touches the network. It
    // also makes the running total exact rather than accumulated across
    // interruptions, which is why the counters start at zero here too.
    let i = 0;
    bytes = 0;
    files = 0;
    let failures = 0;
    let firstError = null;
    const remaining = source.files.length;

    const worker = async () => {
      while (!stopped()) {
        const idx = i++;
        if (idx >= source.files.length) return;
        const url = source.host + source.files[idx];
        try {
          const hit = await withDeadline(cache.match(url), 15000, "el almacen");
          if (hit) {
            bytes += Number(hit.headers.get("Content-Length") || 0);
            files += 1;
          } else {
            // 45 s, not 20: the deadline is here to catch a socket that has
            // died, and a phone on a bad connection is slow without being dead.
            // A file that does trip it is simply not cached, so pressing again
            // picks it up.
            const res = await limitedFetch(url, { signal }, 45000);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              await withDeadline(
                putBytes(
                  cache,
                  url,
                  buf,
                  res.headers.get("Content-Type") || "application/octet-stream"
                ),
                15000,
                "el almacen"
              );
              bytes += buf.byteLength;
              files += 1;
            }
            // a 404 here is a file the archive lists and the host does not have:
            // skipped, exactly like a hole in a survey
          }
        } catch (e) {
          if (stopped()) return;
          // One flaky file must not end a 178 MB download - it is not in the
          // cache, so opening the source again picks it up. But they are counted:
          // a run where EVERY file failed used to walk to the end and report
          // "Completo" with nothing downloaded, which is the worst answer a
          // downloader can give.
          failures++;
          if (!firstError) firstError = e && e.message ? e.message : String(e);
        }
        setProgress(source.id, {
          bytes,
          files,
          chunk: Math.min(i, source.files.length),
          done: false,
        });
        onTick(bytes, files);
      }
    };

    const lanes = Math.max(1, Math.min(FILE_CONCURRENCY, remaining));
    await Promise.all(Array.from({ length: lanes }, worker));

    if (!stopped() && files === 0 && failures > 0) {
      throw new Error(failures + " archivos sin descargar — " + firstError);
    }
    if (!stopped() && failures > 0) {
      // some got through: not a failure, but not a clean sweep either, and the
      // next press will pick up exactly the ones that are missing
      throw new Error(
        "faltan " + failures + " de " + source.files.length + " — " + firstError
      );
    }
  }
  else if (source.kind === "bundle") {
    // the survey settings file, which the engine reads before any tile
    try {
      if (!(await withDeadline(cache.match(DSS_PROPERTIES), 15000, "el almacen"))) {
        const r = await limitedFetch(DSS_PROPERTIES, { signal });
        if (r.ok) {
          await putBytes(cache, DSS_PROPERTIES, await r.arrayBuffer(), "text/plain");
        }
      }
    } catch (e) {}

    // Sized per source now, so a resume may find a progress mark written when a
    // chunk meant something else. It records the size it was counted in; convert
    // through tiles and round DOWN, so the worst case is one run fetched twice
    // rather than one run silently skipped.
    const tpc = source.tilesPerChunk || TILES_PER_CHUNK;
    const chunks = Math.ceil(source.tiles / tpc);
    let firstChunk = p.chunk || 0;
    if (p.tpc && p.tpc !== tpc) {
      firstChunk = Math.floor((firstChunk * p.tpc) / tpc);
    } else if (!p.tpc && firstChunk > 0) {
      firstChunk = Math.floor((firstChunk * TILES_PER_CHUNK) / tpc);
    }

    let bytesBase = 0;                      // what the chunk in flight adds to
    for (let c = firstChunk; c < chunks; c++) {
      bytesBase = 0;
      if (stopped()) break;
      const from = c * tpc;
      const to = Math.min(from + tpc - 1, source.tiles - 1);
      const url =
        source.host + "bundle?survey=" + source.survey + "&version=" + source.version +
        "&order=" + source.order + "&from=" + from + "&to=" + to;

      let buf = null;
      for (let attempt = 0; attempt < 3 && !stopped(); attempt++) {
        try {
          // a bundle is tens of megabytes: the deadline is for a dead socket,
          // not for a slow one, so it is generous
          const res = await limitedFetch(url, { signal }, 90000);
          if (!res.ok) throw new Error("HTTP " + res.status);
          // Read the body as it arrives rather than waiting for all of it.
          //
          // A chunk is about 46 MB, which is half a minute on a phone, and with
          // arrayBuffer() nothing was reported until the whole thing landed: the
          // bar sat at 0% long enough to look broken, and at Norder8 it would sit
          // there 394 times. Streamed, the count moves the whole way down.
          buf = await readWithProgress(res, bytesBase + bytes, onTick, files);
          break;
        } catch (e) {
          if (stopped()) return { bytes, files, done: false };
          if (attempt === 2) throw e;      // three goes, then say so
          // Three goes at three quarters of a minute each is over two minutes,
          // and a row that says "Conectando..." for all of it is the very thing
          // that looked broken. Say which go this is.
          onNote("Reintentando (" + (attempt + 2) + "/3)…");
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      if (!buf) break;

      // The stream already reported these bytes on the way in; counting them
      // again out of the tar would show the download running at twice its size.
      const writes = [];
      let unpacked = 0;
      untar(buf, (name, data) => {
        const m = /^Npix(\d+)\.(\w+)$/.exec(name);
        if (!m) return;
        // copied out of the chunk here: the chunk is released as soon as this
        // loop ends, and a cache entry pointing into it would go with it
        writes.push(
          putBytes(cache, tileUrl(source, Number(m[1]), m[2]), data.slice(), "image/" + m[2])
        );
        unpacked += data.byteLength;
        files += 1;
      });
      await Promise.all(writes);

      bytes += unpacked;
      setProgress(source.id, { bytes, files, chunk: c + 1, tpc, done: false });
      onTick(bytes, files);
    }
  }

  const done = !stopped();
  setProgress(source.id, {
    bytes,
    files,
    chunk:
      source.kind === "files"
        ? source.files.length
        : Math.ceil(source.tiles / (source.tilesPerChunk || TILES_PER_CHUNK)),
    tpc: source.kind === "files" ? undefined : source.tilesPerChunk || TILES_PER_CHUNK,
    done,
  });
  return { bytes, files, done };
}

/**
 * Give a source back. Deliberate, one source at a time, and it says how many
 * entries went - 27 GB disappearing without a number attached is unnerving.
 */
export async function remove(source, opts) {
  const onTick = (opts && opts.onTick) || function () {};
  const cache = await withDeadline(caches.open(DATA_CACHE), 15000, "el almacen");
  let gone = 0;

  // In batches, and giving the thread back between them.
  //
  // This used to be one `await cache.delete(...)` after another, which froze the
  // app: a thousand entries held the main thread for a second - long enough that
  // the row could not even paint the word "Borrando" - and Norder8 is 786,423
  // tiles tried against three extensions, which is over two million round trips
  // taken one at a time. The app would have appeared hung for the best part of
  // an hour.
  //
  // Sixty-four at a time is enough to keep the store busy, and the setTimeout
  // between batches is what lets Svelte repaint and the finger be felt.
  const BATCH = 64;
  const runBatch = async (urlsPerItem) => {
    const results = await Promise.all(
      urlsPerItem.map(async (urls) => {
        for (const u of urls) if (await cache.delete(u)) return true;
        return false;
      })
    );
    gone += results.filter(Boolean).length;
    onTick(gone);
    await new Promise((r) => setTimeout(r, 0));
  };

  if (source.kind === "files") {
    for (let i = 0; i < source.files.length; i += BATCH) {
      await runBatch(source.files.slice(i, i + BATCH).map((rel) => [source.host + rel]));
    }
  } else {
    // The extension is uniform across a survey, so it is worth learning once
    // rather than paying for two misses on every one of three-quarters of a
    // million tiles.
    const EXTS = ["webp", "jpg", "png"];

    // Learn it by LOOKING, before anything is deleted - asking after the fact
    // would only ever find what was just removed. A survey has holes, so probe a
    // handful of tiles rather than trusting the first.
    let ext = null;
    for (let n = 0; n < Math.min(64, source.tiles) && !ext; n++) {
      for (const e of EXTS) {
        if (await cache.match(tileUrl(source, n, e))) { ext = e; break; }
      }
    }
    const extsFor = ext ? [ext] : EXTS;

    for (let npix = 0; npix < source.tiles; npix += BATCH) {
      const end = Math.min(npix + BATCH, source.tiles);
      const items = [];
      for (let n = npix; n < end; n++) {
        items.push(extsFor.map((e) => tileUrl(source, n, e)));
      }
      await runBatch(items);
    }
  }
  clearProgress(source.id);
  return gone;
}
