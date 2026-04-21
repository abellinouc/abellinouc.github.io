<script>
  import { onMount } from "svelte";
  import DebugPanel from "./components/DebugPanel.svelte";
  import Telescope, { computeFovFromEyepiece } from "./Telescope.js";
  import { initializeStellariumEngine } from "./services/stellariumEngine.js";
  import { createOrientationController } from "./services/orientationController.js";

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

  let isDebugPanelVisible = false;
  let invertVerticalMotion = true;
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
      gyro: { x: 0, y: 0, z: 0 },
      absQuat: { x: 0, y: 0, z: 0, w: 0 },
      coords: { yaw: 0, pitch: 0, yawDeg: 0, pitchDeg: 0 },
      fovRad: 0,
      fovDeg: 0,
      targetLogFov: 0,
      currentLensLevel: 0,
      telescope: telescopeSnapshot(),
      engineTime: getEngineTime(),
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
    let engine;

    const CALIBRATE_ON_START = true; // Cambiar para desactivar calibración automática

    const MAX_FOV = 3.228859;
    const MIN_FOV = 0.000005;
    const FOV_STEP = 0.1;
    const LENS_FOCAL_LENGTHS = [null, "eye", 40, 20, 10, 4, 2, 1/4];
    const NO_LENS_BLUR = 90;
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
    }

    function updateStellariumFov({ fov }) {
      if (!engine || !engine.core) return;
      engine.core.fov = fov;
      const degFov = (fov * 180) / Math.PI;
      telescope.setEyepieceFocalLength((telescope.focalLength * degFov) / 100);
      setDebug({ fovRad: fov, fovDeg: degFov, telescope: telescopeSnapshot() });
    }

    function updateStellariumBlur({ blur }) {
      if (canvasEl) canvasEl.style.filter = `blur(${blur}px)`;
    }

    async function initEngine() {
      await initializeStellariumEngine({
        canvas: canvasEl,
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
        updateStellariumBlur({ blur: NO_LENS_BLUR });
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
        updateStellariumBlur({ blur: 0 });
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
      updateStellariumBlur({ blur: 0 });
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

      if (key >= "0" && key <= "7") {
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
    applyLensLevel(0);

    const timeUpdateInterval = setInterval(() => {
      setDebug({ engineTime: getEngineTime() });
    }, 1000);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      orientation.stop();
      clearInterval(timeUpdateInterval);
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
  <div id="calibration-overlay" bind:this={overlayEl}>
    <h2 class="pulse">CALIBRANDO SENSORES</h2>
    <p>Mantenga el dispositivo estatico...</p>
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
    transform: rotate(180deg);
  }

  main {
    width: 100%;
    height: 100%;
    position: relative;
  }

  #stel-canvas {
    width: 100%;
    height: 50%;
    display: block;
    position: absolute;
    top:50%;
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
    top: 75%;
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

    @media (min-width: 600px) {
  :global(#app) {
    transform: rotate(0deg);

  }
  #stel-canvas {
    width: 100%;
    height: 100%;
    display: block;
    position: absolute;
    top:0%;
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
}
</style>
