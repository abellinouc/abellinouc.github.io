<script>
  import { onMount, onDestroy } from "svelte";
  import DebugPanel from "./components/DebugPanel.svelte";
  import DownloadPanel from "./components/DownloadPanel.svelte";
  import Telescope, { computeFovFromEyepiece } from "./Telescope.js";
  import { initializeStellariumEngine } from "./services/stellariumEngine.js";
  import { createOrientationController } from "./services/orientationController.js";
  import { loadConfig } from "./config";

  // The offline button, and why it is conditional.
  //
  // In a browser tab the storage is evictable: the browser may hand back 27 GB
  // the moment the phone gets tight, and offering a download there is offering
  // something we cannot keep. Installed, the origin can be made persistent and
  // the promise is real - so the button exists only there.
  //
  // display-mode covers Android and desktop; navigator.standalone is the iOS
  // spelling of the same question.
  let isInstalled = false;
  let isDownloadPanelOpen = false;
  let panelEverOpened = false;

  /**
   * Keeping the screen on.
   *
   * Two reasons, and the second is the one that bites. A phone held up at the
   * sky is not being touched, so it dims and locks in the middle of what it is
   * being used for. And a download of tens of gigabytes takes long enough that
   * the screen going off is not a nuisance, it is an interruption: with the app
   * in the background the browser throttles its timers and its fetches, and the
   * transfer stops in a way that looks like the app is broken.
   *
   * The lock is released by the browser whenever the page is hidden - that is
   * the specification, not a bug - so it is taken again on every return to
   * visible. Unsupported browsers simply carry on without it.
   */
  let wakeLock = null;
  let screenAwake = false;

  async function keepScreenOn() {
    if (!("wakeLock" in navigator) || wakeLock) return;
    if (document.visibilityState !== "visible") return;   // a hidden page cannot hold one
    try {
      const sentinel = await navigator.wakeLock.request("screen");
      wakeLock = sentinel;
      screenAwake = true;
      sentinel.addEventListener("release", () => {
        if (wakeLock === sentinel) wakeLock = null;
        screenAwake = false;
      });
    } catch (e) {
      wakeLock = null;
      screenAwake = false;
    }
  }

  async function letScreenSleep() {
    const held = wakeLock;
    wakeLock = null;
    screenAwake = false;
    if (held) {
      try {
        await held.release();
      } catch (e) {}
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible") keepScreenOn();
  }

  // Whether the lock is actually held is invisible from the outside - the screen
  // simply does not dim - so it is readable for a check.
  $: if (typeof window !== "undefined") window.__screenAwake = screenAwake;

  let canvasEl;
  let overlayEl;
  let onDebugRecalibrate = () => {};
  let onDebugCancelCalibration = () => {};
  let onDebugSelectLens = () => {};
  let onDebugSimulateCardChange = () => {};
  let onDebugZoomIn = () => {};
  let onDebugZoomOut = () => {};
  let onDebugToggleVertical = () => {};
  
  const JULIAN_HOUR = 1 / 24;

  function addHour() {
    // Cerchiamo l'engine direttamente nell'istanza globale o variabile
    const core = window.currentStelEngine?.core; 
    if (core?.observer) {
      core.observer.utc += JULIAN_HOUR;
      console.log("Ora +1");
    }
  }

  function subHour() {
    const core = window.currentStelEngine?.core;
    if (core?.observer) {
      core.observer.utc -= JULIAN_HOUR;
      console.log("Ora -1");
    }
  }

  let isDebugPanelVisible = false; // será actualizado según config
  let invertVerticalMotion = false;
  let appConfig = null;
  const telescope = new Telescope("Prototipo", "refractor", 200, 1200);

  const RAD_TO_DEG = 180 / Math.PI;

  function jdnToDate(jdn) {
    if (!jdn) return null;
    const UNIX_EPOCH_JDN = 2440587.5;
    const ms = (jdn - UNIX_EPOCH_JDN) * 86400000;
    return new Date(ms);
  }

  function formatDate(date) {
    if (!date || !(date instanceof Date)) return "-";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  function getEngineTime() {
    const utc = window.currentStelEngine?.core?.observer?.utc;
    if (!utc) return { jdn: null, date: "-" };
    const dateObj = jdnToDate(utc);
    return {
      jdn: utc.toFixed(6),
      date: formatDate(dateObj),
    };
  }

  function telescopeSnapshot() {
    return {
      // name: telescope.name,
      // type: telescope.type,
      aperture: telescope.aperture,
      focalLength: telescope.focalLength,
      eyepieceFocalLength: telescope.eyepieceFocalLength,
      magnification: telescope.magnification,
      // ra: telescope.ra,
      // dec: telescope.dec,
      // alt: telescope.alt,
      // az: telescope.az,
    };
  }

  function createDebugState() {
    return {
      activeSensorMode: "absolute",
      activeSource: "boot",
      calibrating: false,
      preCalibrating: false,
      preCalibStatus: "moving",
      preCalibCountdown: 2,
      gyro: { x: 0, y: 0, z: 0 },
      absQuat: { x: 0, y: 0, z: 0, w: 0 },
      coords: { yaw: 0, pitch: 0, yawDeg: 0, pitchDeg: 0 },
      fovRad: 0,
      fovDeg: 0,
      targetLogFov: 0,
      currentLensLevel: 0,
      telescope: telescopeSnapshot(),
      engineTime: getEngineTime(),
      env: "-",
    };
  }

  let debugState = createDebugState();

  function toDegrees(radians) {
    return radians * RAD_TO_DEG;
  }

  function setDebug(partial) {
    debugState = { ...debugState, ...partial };
  }

  function setDebugCoords(yaw, pitch) {
    telescope.setAltAz(pitch, yaw);
    debugState = {
      ...debugState,
      coords: {
        yaw,
        pitch,
        yawDeg: toDegrees(yaw),
        pitchDeg: toDegrees(pitch),
      },
      telescope: telescopeSnapshot(),
    };
  }

  onMount(() => {
    keepScreenOn();
    document.addEventListener("visibilitychange", onVisibilityChange);
  });

  onDestroy(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    letScreenSleep();
  });

  onMount(async () => {
    // Installed or in a tab? The offline button hangs off the answer.
    try {
      isInstalled =
        (window.matchMedia &&
          (window.matchMedia("(display-mode: standalone)").matches ||
            window.matchMedia("(display-mode: fullscreen)").matches)) ||
        window.navigator.standalone === true;
    } catch (e) {
      isInstalled = false;
    }

    // Load environment-specific configuration
    appConfig = await loadConfig();

    console.log("Configuración cargada en App:", appConfig);

    debugState.env = appConfig.env;

    isDebugPanelVisible = appConfig.enableDebugPanel;

    let engine;

    const CALIBRATE_ON_START = appConfig.calibrateOnStart;

    const MAX_FOV = 3.228859;
    const MIN_FOV = 0.000005;
    const FOV_STEP = 0.1;
    const LENS_FOCAL_LENGTHS = {
      1: "eye",
      2: 40,
      3: 6,
      4: 0.5,
      5: "eye",
      6: 40,
      7: 6,
      8: 0.5,
    };
    const NO_LENS_BLUR = 5;
    const HUMAN_EYE_FOV = Math.PI / 3;

    let currentLensLevel = 0;
    let currentFov = MAX_FOV;
    let logFov = Math.log(MAX_FOV);

    setDebug({
      fovRad: currentFov,
      fovDeg: toDegrees(currentFov),
      targetLogFov: logFov,
      currentLensLevel,
    });

    function updateStellariumView({ h, v }) {
      if (!engine || !engine.core || !engine.core.observer) return;
      engine.core.observer.yaw = -h;
      engine.core.observer.pitch = invertVerticalMotion ? -v : v;
      registerZoomMotion(h, v);
    }

    function updateStellariumFov({ fov }) {
      if (!engine || !engine.core) return;
      engine.core.fov = fov;
      const degFov = (fov * 180) / Math.PI;
      telescope.setEyepieceFocalLength((telescope.focalLength * degFov) / 100);
      setDebug({ fovRad: fov, fovDeg: degFov, telescope: telescopeSnapshot() });
    }



    async function initEngine() {
      await initializeStellariumEngine({
        canvas: canvasEl,
        smalldataBaseUrl: appConfig.smallDataPath,
        bigdataBaseUrl: appConfig.bigDataPath,
        onReady(stel) {
          engine = stel;
        },
      });
    }

    function applyLensLevel(level) {
      currentLensLevel = level;

      if (level === 0) {
        // currentFov = MAX_FOV;
        // logFov = Math.log(currentFov);
        // updateStellariumFov({ fov: currentFov });
        telescope.setEyepieceFocalLength(0);
        setDebug({
          currentLensLevel,
          targetLogFov: logFov,
          fovRad: currentFov,
          fovDeg: toDegrees(currentFov),
          telescope: telescopeSnapshot(),
        });
        return;
      }

      const lens = LENS_FOCAL_LENGTHS[level];

      if (lens === "eye") {
        currentFov = HUMAN_EYE_FOV;
        logFov = Math.log(currentFov);
        updateStellariumFov({ fov: currentFov });
        telescope.setEyepieceFocalLength(0);
        setDebug({
          currentLensLevel,
          targetLogFov: logFov,
          fovRad: currentFov,
          fovDeg: toDegrees(currentFov),
          telescope: telescopeSnapshot(),
        });
        return;
      }

      if (!lens) return;

      telescope.setEyepieceFocalLength(lens);
      const fov = computeFovFromEyepiece(telescope, lens);
      currentFov = fov;
      logFov = Math.log(fov);
      updateStellariumFov({ fov });
      setDebug({
        currentLensLevel,
        targetLogFov: logFov,
        fovRad: currentFov,
        fovDeg: toDegrees(currentFov),
        telescope: telescopeSnapshot(),
      });
    }

    let targetLogFov = logFov;
    const ZOOM_SMOOTHING = 0.12;
    let zoomAnimating = false;
    const ZOOM_MOTION_THRESHOLD = 0.015;
    let lastZoomMotion = null;

    function startZoomLoop() {
      if (zoomAnimating) return;
      zoomAnimating = true;

      const step = () => {
        const delta = targetLogFov - logFov;
        if (Math.abs(delta) < 1e-4) {
          logFov = targetLogFov;
          zoomAnimating = false;
          setDebug({ targetLogFov });
          return;
        }
        logFov += delta * ZOOM_SMOOTHING;

        currentFov = Math.exp(logFov);
        updateStellariumFov({ fov: currentFov });
        setDebug({ targetLogFov });

        requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    }



    function registerZoomMotion(h, v) {
      if (!Number.isFinite(h) || !Number.isFinite(v)) return;

      if (!lastZoomMotion) {
        lastZoomMotion = { h, v };
        return;
      }

      const deltaH = h - lastZoomMotion.h;
      const deltaV = v - lastZoomMotion.v;
      const motionDistance = Math.hypot(deltaH, deltaV);

      if (motionDistance < ZOOM_MOTION_THRESHOLD) return;

      lastZoomMotion = { h, v };
    }

    function applyZoomDelta(delta) {
      targetLogFov += delta;
      targetLogFov = Math.min(Math.log(MAX_FOV), Math.max(Math.log(MIN_FOV), targetLogFov));
      setDebug({ targetLogFov });
      startZoomLoop();
    }

    function triggerRecalibration() {
      orientation.startCalibration();
    }

    function triggerCancelCalibration() {
      orientation.cancelCalibration();
    }

    function triggerLens(level) {
      applyLensLevel(level);
      targetLogFov = logFov;
      setDebug({ targetLogFov });
    }

    function triggerCardChange(level) {
      triggerLens(level);
    }

    function triggerZoomIn() {
      applyZoomDelta(-FOV_STEP);
    }

    function triggerZoomOut() {
      applyZoomDelta(FOV_STEP);
    }

    function toggleVerticalMotion() {
      invertVerticalMotion = !invertVerticalMotion;
    }

    const orientation = createOrientationController({
      getLogFov: () => logFov,
      onDebug: (partial) => setDebug(partial),
      onCoords: ({ yaw, pitch }) => setDebugCoords(yaw, pitch),
      onView: ({ h, v }) => updateStellariumView({ h, v }),
      onCalibrationVisibility: (visible) => {
        if (overlayEl) overlayEl.style.display = visible ? "block" : "none";
      },
      onError: (error) => console.error("Sensor error:", error),
    });

    onDebugRecalibrate = triggerRecalibration;
    onDebugCancelCalibration = triggerCancelCalibration;
    onDebugSelectLens = triggerLens;
    onDebugSimulateCardChange = triggerCardChange;
    onDebugZoomIn = triggerZoomIn;
    onDebugZoomOut = triggerZoomOut;
    onDebugToggleVertical = toggleVerticalMotion;

    function handleKeyDown(e) {
      const key = e.key.toLowerCase();

      if (key === "c") {
        triggerRecalibration();
        return;
      }

      if (key >= "1" && key <= "8") {
        triggerLens(parseInt(key, 10));
        return;
      }

      if (key === "+" || key === "=") {
        triggerZoomIn();
        return;
      }
      if (key === "-") {
        triggerZoomOut();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    initEngine().catch((err) => {
      console.error("Engine initialization failed:", err);
    });

    orientation.start( CALIBRATE_ON_START );
    const initialLensLevel = appConfig.calibrateOnStart ? 0 : 1;
    applyLensLevel(initialLensLevel);

    const timeUpdateInterval = setInterval(() => {
      setDebug({ engineTime: getEngineTime() });
    }, 1000);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      orientation.stop();
      clearInterval(timeUpdateInterval);
      lastZoomMotion = null;
      onDebugRecalibrate = () => {};
      onDebugCancelCalibration = () => {};
      onDebugSelectLens = () => {};
      onDebugSimulateCardChange = () => {};
      onDebugZoomIn = () => {};
      onDebugZoomOut = () => {};
      onDebugToggleVertical = () => {};
      
    };
  });
</script>

<main>
  <canvas id="stel-canvas" bind:this={canvasEl}></canvas>
  <button
    id="debug-toggle"
    type="button"
    aria-pressed={isDebugPanelVisible}
    on:click={() => (isDebugPanelVisible = !isDebugPanelVisible)}
  >
    {isDebugPanelVisible ? "Ocultar debug" : "Mostrar debug"}
  </button>
  <div class="crosshair" aria-hidden="true"></div>
  {#if isInstalled}
    <button
      id="offline-toggle"
      type="button"
      title="Datos sin conexión"
      aria-label="Datos sin conexión"
      on:click={() => {
        panelEverOpened = true;
        isDownloadPanelOpen = true;
      }}
    >
      <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
        <path
          d="M12 3v10m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  {/if}
  <!-- Mounted for good once it has been opened. Closing it used to DESTROY it,
       and with it the queue and everything it knew about what was running: the
       transfers carried on invisibly, and reopening offered to start them
       again. Hidden, not unmounted. -->
  {#if panelEverOpened}
    <DownloadPanel
      visible={isDownloadPanelOpen}
      onNeedScreen={keepScreenOn}
      onClose={() => (isDownloadPanelOpen = false)}
    />
  {/if}
  <div id="calibration-overlay" bind:this={overlayEl}>
    {#if debugState.preCalibrating}
      {#if debugState.preCalibStatus === "moving"}
        <h2 class="pulse warning-text">MOVIMIENTO DETECTADO</h2>
        <p>Mantenere fermo il telefono...</p>
      {:else}
        <h2 class="pulse">PREPARANDO</h2>
        <p>La calibración empieza en {debugState.preCalibCountdown}...</p>
      {/if}
    {:else if debugState.calibrating}
      <h2 class="pulse">CALIBRANDO SENSORES</h2>
      <p>Mantenga el dispositivo estatico...</p>
    {/if}
  </div>
  {#if isDebugPanelVisible}
    <DebugPanel
      debug={debugState}
      invertVertical={invertVerticalMotion}
      onRecalibrate={onDebugRecalibrate}
      onCancelCalibration={onDebugCancelCalibration}
      onSelectLens={onDebugSelectLens}
      onSimulateCardChange={onDebugSimulateCardChange}
      onZoomIn={onDebugZoomIn}
      onZoomOut={onDebugZoomOut}
      onToggleVertical={onDebugToggleVertical}
      onAddHour={addHour} 
      onSubHour={subHour}
    />
  {/if}
</main>

<style>
  /* Bottom left, small, out of the way of the sky. It is a utility, not a
     control: the app is a telescope and this is the cupboard behind it. */
  #offline-toggle {
    position: fixed;
    left: max(10px, env(safe-area-inset-left));
    bottom: max(10px, env(safe-area-inset-bottom));
    z-index: 40;
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    border: 1px solid rgba(159, 178, 214, 0.35);
    background: rgba(5, 7, 13, 0.55);
    color: #9fb2d6;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    padding: 0;
  }
  #offline-toggle:active {
    background: rgba(79, 195, 247, 0.18);
    color: #4fc3f7;
  }



  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;

  }

  :global(html),
  :global(body),
  :global(#app) {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
  }

  main {
    width: 100%;
    height: 100%;
    position: relative;
  }

  #stel-canvas {
    width: 100%;
    height: 100%;
    display: block;
    position: absolute;
    top: 0;
  }

  #debug-toggle {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 50;
    background: rgba(12, 16, 24, 0.82);
    border: 1px solid rgba(0, 212, 255, 0.5);
    color: #d8f7ff;
    border-radius: 8px;
    padding: 8px 10px;
    cursor: pointer;
    font: 12px/1.2 "Consolas", "Courier New", monospace;
  }

  #debug-toggle:hover {
    background: rgba(0, 212, 255, 0.28);
  }

  .crosshair {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 40px;
    height: 40px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 20;
  }

  .crosshair::before,
  .crosshair::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 8px rgba(0, 212, 255, 0.6);
  }

  .crosshair::before {
    width: 28px;
    height: 2px;
    transform: translate(-50%, -50%);
  }

  .crosshair::after {
    width: 2px;
    height: 28px;
    transform: translate(-50%, -50%);
  }

  #calibration-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: #00d4ff;
    padding: 30px 50px;
    border-radius: 15px;
    border: 1px solid #00d4ff;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    text-align: center;
    z-index: 9999;
    display: none;
    pointer-events: none;
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
    backdrop-filter: blur(5px);
  }

  #calibration-overlay p {
    color: white;
    margin-top: 10px;
    font-size: 1.2rem;
  }

  .warning-text {
    color: #ff3333 !important;
  }

  .pulse {
    animation: pulse-animation 1.5s infinite;
  }

  @keyframes pulse-animation {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
    100% {
      opacity: 1;
    }
  }
</style>
