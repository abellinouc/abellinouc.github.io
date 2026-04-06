<script>
  import { onMount } from "svelte";
  import DebugPanel from "./components/DebugPanel.svelte";

  let canvasEl;
  let overlayEl;
  let onDebugRecalibrate = () => {};
  let onDebugSelectLens = () => {};
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

  const RAD_TO_DEG = 180 / Math.PI;

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
    debugState = {
      ...debugState,
      coords: {
        yaw,
        pitch,
        yawDeg: toDegrees(yaw),
        pitchDeg: toDegrees(pitch),
      },
    };
  }

  onMount(() => {
    let engine;

    const MAX_FOV = 3.228859;
    const MIN_FOV = 0.000005;
    const FOV_STEP = 0.1;

    let currentLensLevel = 0;
    let currentFov = MAX_FOV;
    const FOCAL_LENGTH = 1200;
    let EYEPIECE_FL = 25;
    let logFov = Math.log(MAX_FOV);

    setDebug({
      fovRad: currentFov,
      fovDeg: toDegrees(currentFov),
      targetLogFov: logFov,
      currentLensLevel,
    });

    function unwrapAngle(angle, reference) {
      while (angle - reference > Math.PI) angle -= 2 * Math.PI;
      while (angle - reference < -Math.PI) angle += 2 * Math.PI;
      return angle;
    }

    function updateStellariumView({ h, v }) {
      if (!engine || !engine.core || !engine.core.observer) return;
      engine.core.observer.yaw = -h;
      engine.core.observer.pitch = invertVerticalMotion ? -v : v;
    }

    function updateStellariumFov({ fov }) {
      if (!engine || !engine.core) return;
      engine.core.fov = fov;
      const degFov = (fov * 180) / Math.PI;
      EYEPIECE_FL = (FOCAL_LENGTH * degFov) / 100;
      setDebug({ fovRad: fov, fovDeg: degFov });
    }

    function updateStellariumBlur({ blur }) {
      if (canvasEl) canvasEl.style.filter = `blur(${blur}px)`;
    }

    function ensureEngineScript() {
      if (typeof window.StelWebEngine === "function") {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const existing = document.querySelector("script[data-stellarium='1']");
        if (existing) {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener(
            "error",
            () => reject(new Error("Failed to load Stellarium script")),
            { once: true }
          );
          return;
        }

        const script = document.createElement("script");
        script.src = "/stellarium-web-engine.js";
        script.dataset.stellarium = "1";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Stellarium script"));
        document.head.appendChild(script);
      });
    }

    async function initEngine() {
      await ensureEngineScript();

      if (typeof window.StelWebEngine !== "function") {
        throw new Error("Stellarium engine script not available");
      }

      window.StelWebEngine({
        wasmFile: "/stellarium-web-engine.wasm",
        canvas: canvasEl,
        async onReady(stel) {
        engine = stel;
        window.currentStelEngine = stel;
        const { core } = stel;

        const now = new Date();
        core.observer.utc = now.getTime() / 86400000 + 2440587.5;

        const defaultLocation = {
          cityName: "Santiago",
          lat: -33.4489,
          lon: -70.6693,
          elev: 570,
          mag: 17.13,
        };

        core.observer.latitude = defaultLocation.lat * (Math.PI / 180);
        core.observer.longitude = defaultLocation.lon * (Math.PI / 180);
        core.observer.elevation = defaultLocation.elev;

        // const baseUrl = "http://localhost:5000/";
        const baseUrl = "https://smalldata.ventanaceleste.com/";
        const dataSourcePromises = [];

        dataSourcePromises.push(
          core.stars.addDataSource({
            url:
              baseUrl +
              "swe-data-packs/minimal/2020-09-01/minimal_2020-09-01_186e7ee2/stars",
            key: "minimal",
          })
        );
        dataSourcePromises.push(
          core.stars.addDataSource({
            url:
              baseUrl +
              "swe-data-packs/base/2020-09-01/base_2020-09-01_1aa210df/stars",
            key: "base",
          })
        );
        dataSourcePromises.push(
          core.landscapes.addDataSource({
            url: baseUrl + "landscapes/v1/guereins",
            key: "guereins",
          })
        );

        [
          "moon",
          "sun",
          "jupiter",
          "mercury",
          "venus",
          "mars",
          "saturn",
          "uranus",
          "neptune",
          "io",
          "europa",
          "ganymede",
          "callisto",
          "moon-normal",
        ].forEach((p) => {
          dataSourcePromises.push(
            core.planets.addDataSource({
              url: baseUrl + `surveys/sso/${p}/v1`,
              key: p,
            })
          );
        });

        dataSourcePromises.push(
          core.stars.addDataSource({
            url:
              baseUrl +
              "swe-data-packs/extended/2020-03-11/extended_2020-03-11_26aa5ab8/stars",
            key: "extended",
          })
        );
        dataSourcePromises.push(
          core.dss.addDataSource({
            url: baseUrl + "surveys/gaia/v1",
            key: "gaia",
          })
        );
        dataSourcePromises.push(
          core.skycultures.addDataSource({
            url: baseUrl + "skycultures/v3/western",
            key: "western",
          })
        );
        dataSourcePromises.push(
          core.dsos.addDataSource({
            url:
              baseUrl +
              "swe-data-packs/base/2020-09-01/base_2020-09-01_1aa210df/dso",
          })
        );
        dataSourcePromises.push(
          core.dsos.addDataSource({
            url:
              baseUrl +
              "swe-data-packs/extended/2020-03-11/extended_2020-03-11_26aa5ab8/dso",
          })
        );
        dataSourcePromises.push(
          core.milkyway.addDataSource({
            url: baseUrl + "surveys/milkyway/v1",
          })
        );
        dataSourcePromises.push(core.dss.addDataSource({ url: baseUrl + "surveys/dss/v1" }));
        dataSourcePromises.push(
          core.minor_planets.addDataSource({
            url: baseUrl + "mpc/v1/mpcorb.dat",
            key: "mpc_asteroids",
          })
        );
        dataSourcePromises.push(
          core.comets.addDataSource({
            url: baseUrl + "mpc/v1/CometEls.txt?v=2019-12-17",
            key: "mpc_comets",
          })
        );

        try {
          await Promise.all(dataSourcePromises);
          core.planets.hints_visible = true;
          core.dsos.hints_visible = true;
          core.minor_planets.hints_visible = false;
          core.dss.hints_visible = false;
          core.stars.hints_visible = true;
          core.comets.hints_visible = false;
          core.cardinals.visible = false;
          core.constellations.lines_visible = true;
          core.constellations.images_visible = false;
          core.constellations.labels_visible = true;
          core.star_relative_scale = 1.0;
          core.stars.label_amount = 3.0;
          core.exposure_scale = 2;
        } catch (error) {
          console.error("Error loading sources:", error);
        }
        },
      });
    }

    const Orientation = {
      gyroFreq: 100,
      absFreq: 30,
      calibDuration: 3,
      fovThreshold: 0.2, //para que sea mas preciso de forma absoluta tambien a niveles de zoom un poco mas altos
      gyroDeadzone: 0.003,
      dynamicThreshold: 0.02,
      dynamicGainMultiplier: 10.0,
      dynamicSmoothingFactor: 0.15,
      gyroSensor: null,
      absSensor: null,
      running: false,
      calibrating: false,
      gyroBias: { x: 0, y: 0, z: 0 },
      biasSamples: [],
      calibSamplesNeeded: 300,
      orient: { pitch: 0, yaw: 0 },
      absOrientLast: null,
      currentMode: "absolute",
      oldX: null,
      oldY: null,
      rawDynamicX: null,
      rawDynamicY: null,
      lastTime: null,
      _pendingRAF: false,

      quaternionToEuler(q) {
        if (!q) return { yaw: 0, pitch: 0 };
        const x = q[0];
        const y = q[1];
        const z = q[2];
        const w = q[3];
        const pitch = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
        const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
        return { yaw, pitch };
      },

      start() {
        this.onCalibReading = this.onCalibReading.bind(this);
        this.onSensorReading = this.onSensorReading.bind(this);
        this.onAbsReading = this.onAbsReading.bind(this);
        setDebug({ activeSource: "sensor-start" });
        this.startSensors();
      },

      stop() {
        this.running = false;
        this.calibrating = false;
        if (this.gyroSensor) {
          try {
            this.gyroSensor.stop();
          } catch {
            // no-op
          }
        }
        if (this.absSensor) {
          try {
            this.absSensor.stop();
          } catch {
            // no-op
          }
        }
      },

      async requestIOSPermissionIfNeeded() {
        if (
          typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function"
        ) {
          await DeviceOrientationEvent.requestPermission();
        }
      },

      async startSensors() {
        try {
          await this.requestIOSPermissionIfNeeded();
          if (!("Gyroscope" in window) || !("RelativeOrientationSensor" in window)) {
            throw new Error("Required sensors not available");
          }
          this.gyroSensor = new Gyroscope({ frequency: this.gyroFreq });
          this.absSensor = new RelativeOrientationSensor({ frequency: this.absFreq });
          this.absSensor.addEventListener("reading", this.onAbsReading);
          this.startCalibration();
        } catch (err) {
          console.error("Sensor start error:", err);
        }
      },

      startCalibration() {
        if (!this.gyroSensor || !this.absSensor) return;

        if (overlayEl) overlayEl.style.display = "block";

        this.calibrating = true;
        this.running = false;

        this.gyroSensor.removeEventListener("reading", this.onSensorReading);
        this.gyroSensor.removeEventListener("reading", this.onCalibReading);

        this.biasSamples = [];
        this.calibSamplesNeeded = this.gyroFreq * this.calibDuration;
        this.currentMode = "absolute";
        setDebug({ calibrating: true, activeSource: "calibration" });

        this.gyroSensor.addEventListener("reading", this.onCalibReading);
        this.gyroSensor.start();
        this.absSensor.start();
      },

      finishCalibration() {
        this.calibrating = false;

        if (overlayEl) overlayEl.style.display = "none";

        this.gyroSensor.removeEventListener("reading", this.onCalibReading);
        const avg = this.biasSamples.reduce(
          (acc, r) => ({ x: acc.x + r.x, y: acc.y + r.y, z: acc.z + r.z }),
          { x: 0, y: 0, z: 0 }
        );
        const len = this.biasSamples.length || 1;
        this.gyroBias = { x: avg.x / len, y: avg.y / len, z: avg.z / len };

        if (this.absOrientLast) {
          const euler = this.quaternionToEuler(this.absOrientLast);
          this.oldX = euler.yaw;
          this.oldY = euler.pitch;
          this.orient.yaw = euler.yaw;
          this.orient.pitch = euler.pitch;
        } else {
          this.oldX = 0;
          this.oldY = 0;
        }

        this.lastTime = performance.now();
        this.gyroSensor.addEventListener("reading", this.onSensorReading);
        this.running = true;
        setDebug({ calibrating: false, activeSource: "calibration-finished" });
      },

      onCalibReading() {
        setDebug({
          gyro: {
            x: this.gyroSensor.x,
            y: this.gyroSensor.y,
            z: this.gyroSensor.z,
          },
        });
        if (this.biasSamples.length < this.calibSamplesNeeded) {
          this.biasSamples.push({
            x: this.gyroSensor.x,
            y: this.gyroSensor.y,
            z: this.gyroSensor.z,
          });
        } else {
          this.finishCalibration();
        }
      },

      onAbsReading() {
        if (!this.absSensor) return;
        this.absOrientLast = this.absSensor.quaternion;
        if (this.absOrientLast) {
          setDebug({
            absQuat: {
              x: this.absOrientLast[0],
              y: this.absOrientLast[1],
              z: this.absOrientLast[2],
              w: this.absOrientLast[3],
            },
          });
        }
      },

      onSensorReading() {
        setDebug({
          gyro: {
            x: this.gyroSensor.x,
            y: this.gyroSensor.y,
            z: this.gyroSensor.z,
          },
        });

        if (this.calibrating) {
          this.lastTime = performance.now();
          return;
        }
        const now = performance.now();
        const dt = Math.max(1e-6, (now - this.lastTime) / 1000);
        this.lastTime = now;

        let currentV = 0.05;
        try {
          currentV = Math.exp(logFov);
        } catch {
          currentV = 0.05;
        }

        const inDynamicZone = currentV < this.dynamicThreshold;

        if (inDynamicZone) {
          let wx = this.gyroSensor.x - this.gyroBias.x;
          let wz = this.gyroSensor.z - this.gyroBias.z;
          const rawDeltaYaw = wz * dt;
          const rawDeltaPitch = wx * dt;
          const zoomRatio = currentV / this.dynamicThreshold;
          const speed = Math.hypot(rawDeltaYaw, rawDeltaPitch);
          const noiseFloor = 0.002;
          const precisionGain =
            speed < noiseFloor ? 0.05 : Math.min(1.0, Math.pow(speed * 100, 2));
          const totalFactor = zoomRatio * precisionGain * this.dynamicGainMultiplier;
          if (this.rawDynamicX === null) {
            this.rawDynamicX = this.oldX;
            this.rawDynamicY = this.oldY;
          }
          this.rawDynamicX += rawDeltaYaw * totalFactor;
          this.rawDynamicY += rawDeltaPitch * totalFactor;
          const k = this.dynamicSmoothingFactor;
          this.oldX += (this.rawDynamicX - this.oldX) * k;
          this.oldY += (this.rawDynamicY - this.oldY) * k;
          this.orient.yaw = this.oldX;
          this.orient.pitch = this.oldY;
          setDebug({ activeSensorMode: "dynamic", activeSource: "gyroscope" });
          setDebugCoords(this.oldX, this.oldY);
          this.updateView(currentV, "DYNAMIC");
        } else {
          this.rawDynamicX = null;
          this.rawDynamicY = null;
          if (this.currentMode === "absolute" && this.absOrientLast) {
            const euler = this.quaternionToEuler(this.absOrientLast);
            this.orient.pitch = euler.pitch;
            this.orient.yaw = euler.yaw;
            setDebug({ activeSource: "absolute-orientation" });
          } else {
            let wx = this.gyroSensor.x - this.gyroBias.x;
            let wz = this.gyroSensor.z - this.gyroBias.z;
            if (Math.abs(wx) < this.gyroDeadzone) wx = 0;
            if (Math.abs(wz) < this.gyroDeadzone) wz = 0;
            this.orient.pitch += wx * dt;
            this.orient.yaw += wz * dt;
            setDebug({ activeSource: "gyroscope" });
          }
          setDebugCoords(this.orient.yaw, this.orient.pitch);
          this.runApplicationLogic(this.orient.pitch, this.orient.yaw, currentV);
        }
      },

      runApplicationLogic(pitch, yaw, fov) {
        const requiredMode = fov < this.fovThreshold ? "gyro" : "absolute";
        if (requiredMode !== this.currentMode) this.transitionToMode(requiredMode);
        setDebug({ activeSensorMode: this.currentMode });
        const sensitivity = this.currentMode === "gyro" ? 0.1 : 0.5;
        if (this.oldX === null || this.oldY === null) {
          this.oldX = yaw;
          this.oldY = pitch;
          return;
        }
        const adjustedYaw = unwrapAngle(yaw, this.oldX);
        this.oldX += (adjustedYaw - this.oldX) * sensitivity;
        this.oldY += (pitch - this.oldY) * sensitivity;
        this.updateView(fov, this.currentMode);
      },

      transitionToMode(newMode) {
        if (newMode === "gyro" && this.currentMode === "absolute") {
          if (this.absOrientLast) {
            const euler = this.quaternionToEuler(this.absOrientLast);
            this.orient.pitch = euler.pitch;
            this.orient.yaw = euler.yaw;
            this.oldX = euler.yaw;
            this.oldY = euler.pitch;
          }
        } else if (newMode === "absolute" && this.currentMode === "gyro") {
          if (this.absOrientLast) {
            const euler = this.quaternionToEuler(this.absOrientLast);
            this.oldX = unwrapAngle(euler.yaw, this.oldX);
            this.oldY = euler.pitch;
          }
        }
        this.currentMode = newMode;
      },

      updateView(vVal) {
        const h = this.oldX;
        const v = this.oldY;

        if (!this._pendingRAF) {
          this._pendingRAF = true;
          requestAnimationFrame(() => {
            updateStellariumView({ h, v });
            this._pendingRAF = false;
          });
        }
      },
    };

    const LENS_FOCAL_LENGTHS = [null, "eye", 40, 32, 24, 16, 10, 4, 1];
    const NO_LENS_BLUR = 90;
    const HUMAN_EYE_FOV = Math.PI / 3;

    function computeFovFromEyepiece(eyepieceFl) {
      const m = FOCAL_LENGTH / eyepieceFl;
      const projectionConst = 100;
      let newFov = projectionConst / m;
      newFov = (newFov * Math.PI) / 180;
      return newFov;
    }

    function applyLensLevel(level) {
      currentLensLevel = level;

      if (level === 0) {
        currentFov = MAX_FOV;
        logFov = Math.log(currentFov);
        updateStellariumFov({ fov: currentFov });
        updateStellariumBlur({ blur: NO_LENS_BLUR });
        setDebug({
          currentLensLevel,
          targetLogFov: logFov,
          fovRad: currentFov,
          fovDeg: toDegrees(currentFov),
        });
        return;
      }

      const lens = LENS_FOCAL_LENGTHS[level];

      if (lens === "eye") {
        currentFov = HUMAN_EYE_FOV;
        logFov = Math.log(currentFov);
        updateStellariumFov({ fov: currentFov });
        updateStellariumBlur({ blur: 0 });
        setDebug({
          currentLensLevel,
          targetLogFov: logFov,
          fovRad: currentFov,
          fovDeg: toDegrees(currentFov),
        });
        return;
      }

      if (!lens) return;

      EYEPIECE_FL = lens;
      const fov = computeFovFromEyepiece(lens);
      currentFov = fov;
      logFov = Math.log(fov);
      updateStellariumFov({ fov });
      updateStellariumBlur({ blur: 0 });
      setDebug({
        currentLensLevel,
        targetLogFov: logFov,
        fovRad: currentFov,
        fovDeg: toDegrees(currentFov),
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
      Orientation.startCalibration();
    }

    function triggerLens(level) {
      applyLensLevel(level);
      targetLogFov = logFov;
      setDebug({ targetLogFov });
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

    onDebugRecalibrate = triggerRecalibration;
    onDebugSelectLens = triggerLens;
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

    Orientation.start();
    applyLensLevel(0);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      Orientation.stop();
      onDebugRecalibrate = () => {};
      onDebugSelectLens = () => {};
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
      onSelectLens={onDebugSelectLens}
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
