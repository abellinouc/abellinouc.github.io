/**
 * What can be taken offline, and how big it is.
 *
 * Every figure below was MEASURED — `du -sb` and a file count over each Norder on
 * the server, not arithmetic on the HiPS tile counts. The two disagree, and the
 * disagreement matters: these surveys have holes. Gaia is 29% of a full sky at
 * Norder8; even DSS is missing nine tiles at Norder8 and one at Norder7. A
 * downloader built on 12·4^N would spend its time chasing tiles that were never
 * there and report a failure at the end of a perfectly good download.
 *
 * DSS stops at Norder8 by choice. Norder9 is another 74.5 GB in 3.1 million
 * tiles, and the 60% quota a browser grants is 60% of the FREE disk: on a phone
 * with 100 GB free that is 60 GB, and Norder9 alone does not fit. It is also the
 * order where the download stops being an evening and becomes a weekend.
 */

export const SMALL_HOST = "https://smalldata.ventanaceleste.com/";
export const BIG_HOST = "https://bigdata.ventanaceleste.com/";

/**
 * How much of a survey to ask for at once - measured in BYTES, not tiles.
 *
 * The bundler exists because an order is expensive in FILES, not in bytes:
 * Norder8 is 27 GB in 786,423 of them, and three-quarters of a million
 * handshakes is where the evening goes. So they come in runs.
 *
 * The run used to be a flat 2000 tiles, and a tile is not a fixed size: 14 kB at
 * Norder3 and 46 kB at Norder6, so the same "2000" meant 27 MB at one end of the
 * pyramid and 88 MB at the other. A chunk is held whole in memory - once as the
 * tar, again as the copy the reader assembles, and a third time as the tiles
 * sliced out of it before any of them are written - so 88 MB of survey is closer
 * to 265 MB of phone. That is where a download stopped dead for a while and then
 * carried on: not the network, not the server, which answers in under half a
 * second, but a phone reclaiming a quarter of a gigabyte.
 *
 * Sized in bytes instead, every order behaves the same way and the peak is about
 * 48 MB. The extra handshakes are ~400 ms each against ~3 s of transfer.
 */
const CHUNK_BYTES = 16 * 1024 * 1024;
const MIN_TILES_PER_CHUNK = 128;
const MAX_TILES_PER_CHUNK = 2000;

/** Kept for the tar reader and for reading progress written before the change. */
export const TILES_PER_CHUNK = 2000;

export function tilesPerChunk(bytes, count) {
  if (!bytes || !count) return MAX_TILES_PER_CHUNK;
  const avg = bytes / count;
  return Math.max(
    MIN_TILES_PER_CHUNK,
    Math.min(MAX_TILES_PER_CHUNK, Math.round(CHUNK_BYTES / avg))
  );
}

// Measured on the server, 21 Aug 2026. bytes, then the number of files that are
// actually there.
const DSS_ORDERS = [
  { order: 3, bytes: 10825328, count: 768 },
  { order: 4, bytes: 63306396, count: 3072 },
  { order: 5, bytes: 405888578, count: 12288 },
  { order: 6, bytes: 2276375616, count: 49152 },
  { order: 7, bytes: 9341821434, count: 196607 },
  { order: 8, bytes: 29464144674, count: 786423 },
];

// 12 · 4^order — what a FULL sky holds at that order. Used to know how far to
// count, never to decide whether the download worked.
export function tilesAtOrder(order) {
  return 12 * Math.pow(4, order);
}

function dssSource(o) {
  return {
    id: `dss-n${o.order}`,
    group: "dss",
    label: `Cielo profundo DSS · Norder ${o.order}`,
    detail:
      o.order <= 5
        ? "Vista general, se descarga en segundos."
        : o.order === 6
        ? "Detalle medio. Suficiente para la mayoría de los oculares."
        : o.order === 7
        ? "Detalle alto. Aquí empieza a notarse en campos de pocos minutos de arco."
        : "Detalle máximo disponible sin conexión. Grande: revise el espacio antes.",
    bytes: o.bytes,
    count: o.count,
    kind: "bundle",
    survey: "dss",
    version: "v1",
    order: o.order,
    tiles: tilesAtOrder(o.order),
    tilesPerChunk: tilesPerChunk(o.bytes, o.count),
    host: BIG_HOST,
    // an order is only useful once the one under it is there: the engine walks
    // down the pyramid and a hole in the middle shows as a blank patch
    requires: o.order > 3 ? `dss-n${o.order - 1}` : null,
  };
}

/**
 * The survey's own settings file. Small, and the engine asks for it before any
 * tile, so it has to be in the cache too or the survey is invisible offline.
 */
export const DSS_PROPERTIES = `${BIG_HOST}surveys/dss/v1/properties`;

export function buildCatalog(smallManifest) {
  const sources = [];

  // smalldata: the eleven groups the engine actually loads, in the order it asks
  // for them. The file list is exact, generated from the published archive, so
  // progress is a real fraction rather than a guess.
  for (const g of smallManifest.groups) {
    sources.push({
      id: `small-${g.id}`,
      group: "small",
      label: g.label,
      detail: null,
      bytes: g.bytes,
      count: g.count,
      kind: "files",
      host: SMALL_HOST,
      files: g.files,
      requires: null,
    });
  }

  DSS_ORDERS.forEach((o) => sources.push(dssSource(o)));
  return sources;
}

export const GROUP_LABELS = {
  small: "Catálogos y texturas",
  dss: "Imágenes del cielo (DSS)",
};

export function formatBytes(n) {
  if (!isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < u.length - 1);
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${u[i]}`;
}
