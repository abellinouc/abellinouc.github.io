<script>
  /**
   * The download panel: what can be kept on the phone, how big it is, and how
   * much room is left.
   *
   * It exists only once the app is INSTALLED. In a browser tab the storage is
   * evictable and the whole thing is a promise the browser has not made; as an
   * installed app it is a promise it has, so the button appears there and only
   * there.
   *
   * Every size shown was measured on the server rather than computed from the
   * HiPS tile counts, because the two disagree - these surveys have holes.
   */
  import { onMount } from "svelte";
  import { buildCatalog, GROUP_LABELS, formatBytes } from "../services/offlineCatalog.js";
  import {
    download,
    remove,
    getProgress,
    storageInfo,
    requestPersistence,
  } from "../services/offlineDownloader.js";

  export let onClose = () => {};
  // Hidden rather than destroyed while it is closed: the queue and everything
  // running has to outlive the ✕.
  export let visible = true;
  // Asked again on a press: the screen lock is granted more readily off the back
  // of a real tap, and a long download is exactly when losing it matters.
  export let onNeedScreen = () => {};

  let sources = [];
  let byGroup = [];
  let store = { quota: null, usage: null, persisted: false, supported: true };
  // Press as many as you like; they come down ONE AT A TIME.
  //
  // They used to run side by side over a shared sixteen lanes, which was the
  // wrong trade twice over. A phone has one pipe: five sources at once is not
  // five downloads, it is five slow ones finishing at the same late moment,
  // none of them usable in the meantime. And a source that is still writing
  // cannot be used, so finishing one is worth more than starting five.
  //
  // So the press is still instant - nothing waits for anything before being
  // accepted - and the queue is visible: a row says where it is in the line,
  // and leaving the line is one tap.
  let active = {};                 // id -> AbortController
  let queued = [];                 // ids waiting their turn, in the order pressed
  let dropping = {};               // id -> true while it is being deleted
  let stopping = {};               // id -> true, from the press until it unwinds
  let rowError = {};               // id -> what went wrong, shown on that row
  let rowNote = {};                // id -> what it is doing while nothing arrives
  let live = {};                   // id -> { bytes, files }
  let error = "";
  let loading = true;

  // id -> progress. Reassigned rather than mutated, and byGroup is nudged with
  // it: the template walks byGroup, so touching `sources` alone left a finished
  // download still offering a Descargar button.
  let state = {};

  async function refreshStorage() {
    store = await storageInfo();
  }

  function refreshProgress() {
    const next = {};
    for (const s of sources) next[s.id] = getProgress(s.id);
    state = next;
    byGroup = byGroup;             // what the template actually iterates
  }

  onMount(async () => {
    try {
      const res = await fetch("./smalldata-manifest.json");
      if (!res.ok) throw new Error("no se pudo leer el catálogo local");
      sources = buildCatalog(await res.json());
      const groups = {};
      for (const s of sources) (groups[s.group] = groups[s.group] || []).push(s);
      byGroup = Object.entries(groups).map(([k, v]) => ({
        key: k,
        label: GROUP_LABELS[k] || k,
        items: v,
      }));
      refreshProgress();
      await refreshStorage();
    } catch (e) {
      error = e.message || String(e);
    } finally {
      loading = false;
    }
  });

  // Every one of these takes the store it reads as an argument, and that is not
  // decoration. Svelte works out what to re-render by looking at the variables
  // named in the template expression - it does not follow a call into the
  // function body. `running(s)` reads `active`, so the template never learnt that
  // pressing Descargar had changed anything: the download ran, the row did not
  // move, and the button sat there saying Descargar. Naming the store in the
  // call is what makes the row live.
  function done(state, s) {
    return (state[s.id] || {}).done === true;
  }

  function started(state, s) {
    const p = state[s.id] || {};
    return !p.done && (p.bytes > 0 || p.chunk > 0);
  }

  function queuePos(queued, s) {
    const i = queued.indexOf(s.id);
    return i < 0 ? null : i + 1;
  }

  function deleting(dropping, s) {
    return dropping[s.id] !== undefined;      // 0 is a real count, not "no"
  }

  function running(active, s) {
    return !!active[s.id];
  }

  function pct(state, live, active, s) {
    const p = state[s.id] || {};
    if (p.done) return 100;
    if (!s.bytes) return 0;
    const b = active[s.id] ? (live[s.id] || {}).bytes || 0 : p.bytes || 0;
    return Math.max(0, Math.min(100, Math.round((b / s.bytes) * 100)));
  }

  function doneBytes(state, live, active, s) {
    return active[s.id] ? (live[s.id] || {}).bytes || 0 : (state[s.id] || {}).bytes || 0;
  }

  /** Whether it will fit at all, so a doomed download is not offered. */
  function fits(store, state, live, active, s) {
    if (!store.supported || store.quota == null || store.usage == null) return true;
    if (done(state, s)) return true;
    const need = s.bytes - ((state[s.id] || {}).bytes || 0);
    // What the downloads already running still have to write is spoken for. Without
    // this every one of them is told there is room for the same last gigabyte.
    let committed = 0;
    for (const other of sources) {
      if (other.id === s.id) continue;
      if (!active[other.id] && !queued.includes(other.id)) continue;
      committed += Math.max(0, other.bytes - doneBytes(state, live, active, other));
    }
    return store.quota - store.usage - committed > need * 1.05;
  }

  /**
   * The order below this one, if it is not there yet.
   *
   * It used to disable the button, which was wrong twice over: it was a guess
   * about the renderer dressed up as a rule, and it stopped somebody grabbing
   * the one order they actually wanted. A survey is a pyramid and the engine
   * asks for the level that suits the zoom - so without Norder3 the sky is blank
   * when you pull back, and perfectly sharp when you push in. That is worth
   * saying and not worth forbidding.
   */
  function missingBelow(state, active, s) {
    if (!s.requires || done(state, s) || active[s.id]) return null;
    const req = sources.find((x) => x.id === s.requires);
    return req && !done(state, req) ? req : null;
  }

  /** Take the press. Run it now if the line is empty, otherwise join the line. */
  function start(s) {
    if (active[s.id] || queued.includes(s.id)) return;
    error = "";
    onNeedScreen();
    const clean = { ...rowError };
    delete clean[s.id];
    rowError = clean;

    if (Object.keys(active).length > 0) {
      queued = [...queued, s.id];             // the row says where it stands
      return;
    }
    run(s);
  }

  /** Leave the line. */
  function unqueue(s) {
    queued = queued.filter((id) => id !== s.id);
  }

  /** Whoever is next, if anyone, and only once the line is clear. */
  function pump() {
    if (Object.keys(active).length > 0 || queued.length === 0) return;
    const id = queued[0];
    queued = queued.slice(1);
    const s = sources.find((x) => x.id === id);
    if (s) run(s);
    else pump();                              // vanished from the catalogue: skip it
  }

  async function run(s) {
    if (active[s.id]) return;                 // this one, not all of them
    error = "";

    // The button has to answer the finger, not the network.
    //
    // It used to look dead for a second or two after a press: the state did
    // change at once, but every progress tick reassigned `live` and re-rendered
    // all seventeen rows, thousands of times a source, and the tap queued behind
    // the repaints. So: flip to a visible "Preparando" the moment it is pressed,
    // and let the ticks arrive at a pace a screen can actually show.
    const ctrl = new AbortController();
    active = { ...active, [s.id]: ctrl };
    live = { ...live, [s.id]: { bytes: (state[s.id] || {}).bytes || 0, files: 0, warming: true } };
    const clean = { ...rowError };
    delete clean[s.id];
    rowError = clean;
    const cleanNote = { ...rowNote };
    delete cleanNote[s.id];
    rowNote = cleanNote;

    // yield once so the "Preparando" is painted before anything blocks
    await new Promise((r) => setTimeout(r, 0));
    requestPersistence();                     // not awaited: it must not hold the press

    let pending = null;
    let timer = null;
    const flush = () => {
      timer = null;
      if (!pending) return;
      live = { ...live, [s.id]: pending };
      pending = null;
    };

    try {
      await download(s, {
        signal: ctrl.signal,
        onNote: (text) => {
          rowNote = { ...rowNote, [s.id]: text };
        },
        onTick: (bytes, files) => {
          pending = { bytes, files, warming: false };
          if (rowNote[s.id]) {
            const n = { ...rowNote };
            delete n[s.id];
            rowNote = n;
          }
          // at most five repaints a second: past that nobody can read it anyway,
          // and every one of them is a frame the panel is not listening in
          if (!timer) timer = setTimeout(flush, 200);
        },
      });
      flush();
    } catch (e) {
      if (!ctrl.signal.aborted) {
        // On the row it belongs to. A message at the top of a list of seventeen
        // does not say which one stopped, and with several running at once that
        // is the only thing worth knowing.
        rowError = { ...rowError, [s.id]: e && e.message ? e.message : String(e) };
      }
    } finally {
      if (timer) clearTimeout(timer);
      const next = { ...active };
      delete next[s.id];
      active = next;
      const nextStop = { ...stopping };
      delete nextStop[s.id];
      stopping = nextStop;
      refreshProgress();
      await refreshStorage();
      pump();                                 // whoever has been waiting
    }
  }

  function warming(live, active, s) {
    return !!active[s.id] && (live[s.id] || {}).warming === true;
  }

  function stop(s) {
    const ctrl = active[s.id];
    if (!ctrl) return;
    // Say so at once. Aborting has to reach a dozen fetches in flight and unwind
    // the loop that is driving them, which took about a second to show - long
    // enough that the second press felt like the first had missed.
    stopping = { ...stopping, [s.id]: true };
    ctrl.abort();
  }

  function stopAll() {
    queued = [];                              // empty the line first, or it refills
    const ids = Object.keys(active);
    stopping = { ...stopping, ...Object.fromEntries(ids.map((id) => [id, true])) };
    for (const id of ids) active[id].abort();
  }

  async function drop(s) {
    // Deleting is not downloading, and it used to be marked as though it were:
    // it went into `active`, so the row offered "Detener" - a button to stop a
    // download that was not running - and stayed that way until the delete had
    // finished. Its own flag, its own word, and it starts the moment it is
    // pressed rather than waiting for anything in the queue.
    if (active[s.id] || dropping[s.id] !== undefined) return;
    dropping = { ...dropping, [s.id]: 0 };   // a COUNT from the start: `true > 0` is true
    unqueue(s);                               // no point queuing what is being binned
    await new Promise((r) => setTimeout(r, 0));   // let "Borrando…" reach the screen
    try {
      await remove(s, {
        onTick: (gone) => {
          dropping = { ...dropping, [s.id]: gone };
        },
      });
    } finally {
      const next = { ...dropping };
      delete next[s.id];
      dropping = next;
      refreshProgress();
      await refreshStorage();
    }
  }
</script>

<div class="sheet" class:hidden={!visible} role="dialog" aria-label="Datos sin conexión">
  <header>
    <h2>Datos sin conexión</h2>
    <div class="head-act">
      {#if Object.keys(active).length + queued.length > 1}
        <button type="button" class="stop small" on:click={stopAll}>Detener todo</button>
      {/if}
      <button class="x" type="button" on:click={onClose} aria-label="Cerrar">✕</button>
    </div>
  </header>

  {#if store.supported && store.quota != null}
    <div class="storage">
      <div class="bar">
        <span style="width:{Math.min(100, (store.usage / store.quota) * 100)}%"></span>
      </div>
      <p>
        <b>{formatBytes(store.quota - store.usage)}</b> disponibles ·
        {formatBytes(store.usage)} en uso de {formatBytes(store.quota)}
        {#if !store.persisted}
          <span class="warn">· almacenamiento no permanente</span>
        {/if}
      </p>
      <p class="hint">
        El navegador concede alrededor del 60 % del espacio libre del teléfono, no del
        total. Por eso el máximo baja a medida que el teléfono se llena.
      </p>
    </div>
  {/if}

  {#if loading}
    <p class="hint">Leyendo el catálogo…</p>
  {/if}
  {#if error}
    <p class="err">{error}</p>
  {/if}

  {#each byGroup as g}
    <h3>{g.label}</h3>
    <ul>
      {#each g.items as s}
        <li class:complete={done(state, s)}>
          <div class="row">
            <div class="who">
              <span class="name">{s.label}</span>
              <span class="size">
                {formatBytes(s.bytes)} · {s.count.toLocaleString("es")} archivos
              </span>
              {#if s.detail}<span class="detail">{s.detail}</span>{/if}
            </div>

            <div class="act">
              {#if deleting(dropping, s)}
                <button type="button" class="stop" disabled>
                  {dropping[s.id] > 0
                    ? "Borrando… " + dropping[s.id].toLocaleString("es")
                    : "Borrando…"}
                </button>
              {:else if queuePos(queued, s)}
                <button type="button" class="queued" on:click={() => unqueue(s)}>
                  En cola · {queuePos(queued, s)}.º
                </button>
              {:else if active[s.id]}
                <button
                  type="button"
                  class="stop"
                  disabled={stopping[s.id]}
                  on:click={() => stop(s)}
                >
                  {stopping[s.id]
                    ? "Deteniendo…"
                    : warming(live, active, s)
                      ? "Preparando…"
                      : "Detener"}
                </button>
              {:else if done(state, s)}
                <button type="button" class="drop" on:click={() => drop(s)}>Borrar</button>
              {:else if !fits(store, state, live, active, s)}
                <span class="blocked">No cabe</span>
              {:else}
                <button type="button" class="get" on:click={() => start(s)}>
                  {started(state, s) ? "Reanudar" : "Descargar"}
                </button>
              {/if}
            </div>
          </div>

          {#if rowError[s.id]}
            <p class="rowerr">{rowError[s.id]}</p>
          {/if}

          {#if missingBelow(state, active, s)}
            <p class="note">
              Se puede descargar igual. Sin {missingBelow(state, active, s).label} el cielo queda
              vacío al alejar el zoom, porque a esa distancia el motor pide ese nivel.
            </p>
          {/if}

          {#if active[s.id] || started(state, s) || done(state, s)}
            <div class="prog"><span style="width:{pct(state, live, active, s)}%"></span></div>
            <div class="under">
              {#if warming(live, active, s)}
                {rowNote[s.id] || "Conectando…"}
              {:else if active[s.id]}
                {formatBytes(doneBytes(state, live, active, s))} de {formatBytes(s.bytes)} · {pct(state, live, active, s)} %
              {:else if done(state, s)}
                Completo
              {:else}
                Incompleto: {pct(state, live, active, s)} %
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/each}

  <p class="hint foot">
    Se puede cerrar esta ventana mientras descarga, pero la aplicación debe seguir
    abierta. Si se interrumpe, la descarga se reanuda donde estaba.
  </p>
</div>

<style>
  .sheet {
    position: fixed;
    inset: 0;
    /* Above the calibration overlay, which sits at 9999 and is pointer-events:
       none - so it does not block the panel, it just prints "MOVIMIENTO
       DETECTADO" across the middle of it while somebody is choosing what to
       download. This is a sheet: while it is open it is the whole screen. */
    z-index: 10000;
    background: #05070d;
    color: #e8eefc;
    overflow-y: auto;
    padding: max(14px, env(safe-area-inset-top)) 14px
      max(18px, env(safe-area-inset-bottom)) 14px;
    font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
    -webkit-overflow-scrolling: touch;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  h2 {
    margin: 0;
    font-size: 1.05rem;
    letter-spacing: 0.02em;
  }
  h3 {
    margin: 20px 0 8px;
    font-size: 0.72rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #7f93b8;
  }
  .x {
    background: none;
    border: 1px solid #2b3550;
    color: #9fb2d6;
    border-radius: 8px;
    width: 34px;
    height: 34px;
    font-size: 15px;
  }
  .storage {
    background: #0b1120;
    border: 1px solid #1c2740;
    border-radius: 10px;
    padding: 11px 12px;
  }
  .bar {
    height: 7px;
    background: #17203a;
    border-radius: 99px;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #4fc3f7, #0284c7);
  }
  .storage p {
    margin: 8px 0 0;
  }
  .warn {
    color: #ffd54f;
  }
  .hint {
    color: #7f93b8;
    font-size: 0.82rem;
  }
  .foot {
    margin-top: 22px;
  }
  .err {
    color: #ff8a80;
    background: #2a1113;
    border: 1px solid #57202a;
    border-radius: 8px;
    padding: 8px 10px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    border: 1px solid #1c2740;
    border-radius: 10px;
    padding: 10px 12px;
    margin-bottom: 8px;
    background: #080d18;
  }
  li.complete {
    border-color: #23503a;
    background: #071410;
  }
  .row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    justify-content: space-between;
  }
  .who {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .name {
    font-weight: 600;
  }
  .size {
    color: #8fa3c8;
    font-size: 0.8rem;
  }
  .detail {
    color: #6d80a4;
    font-size: 0.78rem;
  }
  .act {
    flex: 0 0 auto;
  }
  button.get,
  button.stop,
  button.drop,
  button.queued {
    border-radius: 8px;
    border: 1px solid;
    padding: 7px 13px;
    font-size: 0.84rem;
    font-weight: 600;
    background: transparent;
  }
  button.get {
    color: #4fc3f7;
    border-color: #2a5f80;
  }
  /* The tap has to answer before anything else does. :active fires on touchdown,
     which is a frame, not a round trip. */
  button.get:active,
  button.stop:active,
  button.drop:active,
  button.queued:active {
    background: rgba(79, 195, 247, 0.22);
    transform: scale(0.96);
  }
  button.get,
  button.stop,
  button.drop,
  button.queued {
    transition: transform 0.06s ease, background 0.06s ease;
    touch-action: manipulation;          /* no 300 ms wait for a double tap */
  }
  /* the bar under a source that has started but has no figure yet */
  li .prog span {
    transition: width 0.2s linear;
  }
  button.stop {
    color: #ffd54f;
    border-color: #6b5a1e;
  }
  button.drop {
    color: #94a6c6;
    border-color: #2b3550;
  }
  /* waiting its turn: readable, but plainly not the one doing the work */
  button.queued {
    color: #8fa8c8;
    border-color: #33405e;
    background: rgba(80, 110, 160, 0.12);
  }
  button[disabled] {
    opacity: 0.55;
  }
  .blocked {
    color: #6d80a4;
    font-size: 0.8rem;
  }
  .sheet.hidden {
    display: none;
  }
  .head-act {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  button.small {
    padding: 6px 10px;
    font-size: 0.78rem;
  }
  .note {
    margin: 8px 0 0;
    color: #c9a227;
    font-size: 0.78rem;
    line-height: 1.35;
  }
  .rowerr {
    margin: 8px 0 0;
    color: #ff8a80;
    font-size: 0.78rem;
    line-height: 1.35;
  }
  .prog {
    height: 4px;
    background: #17203a;
    border-radius: 99px;
    overflow: hidden;
    margin-top: 9px;
  }
  .prog span {
    display: block;
    height: 100%;
    background: #4fc3f7;
  }
  li.complete .prog span {
    background: #3ddc84;
  }
  .under {
    margin-top: 5px;
    color: #7f93b8;
    font-size: 0.78rem;
  }
</style>
