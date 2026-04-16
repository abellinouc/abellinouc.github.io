function unwrapAngle(angle, reference) {
  while (angle - reference > Math.PI) angle -= 2 * Math.PI;
  while (angle - reference < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

export function createOrientationController({
  getLogFov = () => 0.05,
  onDebug = () => {},
  onCoords = () => {},
  onView = () => {},
  onCalibrationVisibility = () => {},
  onError = () => {},
} = {}) {
  const state = {
    gyroFreq: 100,
    absFreq: 30,
    calibDuration: 3,
    fovThreshold: 0.2,
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
    pendingRAF: false,
  };

  function quaternionToEuler(q) {
    if (!q) return { yaw: 0, pitch: 0 };
    const x = q[0];
    const y = q[1];
    const z = q[2];
    const w = q[3];
    const pitch = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y));
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    return { yaw, pitch };
  }

  function emitDebug(partial) {
    onDebug(partial);
  }

  function emitCoords(yaw, pitch) {
    onCoords({
      yaw,
      pitch,
      yawDeg: (yaw * 180) / Math.PI,
      pitchDeg: (pitch * 180) / Math.PI,
    });
  }

  function updateView() {
    const h = state.oldX;
    const v = state.oldY;

    if (!state.pendingRAF) {
      state.pendingRAF = true;
      requestAnimationFrame(() => {
        onView({ h, v });
        state.pendingRAF = false;
      });
    }
  }

  function finishCalibration() {
    state.calibrating = false;
    onCalibrationVisibility(false);

    if (state.gyroSensor) {
      state.gyroSensor.removeEventListener("reading", onCalibReading);
    }

    const avg = state.biasSamples.reduce(
      (acc, sample) => ({ x: acc.x + sample.x, y: acc.y + sample.y, z: acc.z + sample.z }),
      { x: 0, y: 0, z: 0 }
    );
    const len = state.biasSamples.length || 1;
    state.gyroBias = { x: avg.x / len, y: avg.y / len, z: avg.z / len };

    if (state.absOrientLast) {
      const euler = quaternionToEuler(state.absOrientLast);
      state.oldX = euler.yaw;
      state.oldY = euler.pitch;
      state.orient.yaw = euler.yaw;
      state.orient.pitch = euler.pitch;
    } else {
      state.oldX = 0;
      state.oldY = 0;
    }

    state.lastTime = performance.now();
    state.gyroSensor.addEventListener("reading", onSensorReading);
    state.running = true;
    emitDebug({ calibrating: false, activeSource: "calibration-finished" });
  }

  function onCalibReading() {
    emitDebug({
      gyro: {
        x: state.gyroSensor.x,
        y: state.gyroSensor.y,
        z: state.gyroSensor.z,
      },
    });

    if (state.biasSamples.length < state.calibSamplesNeeded) {
      state.biasSamples.push({
        x: state.gyroSensor.x,
        y: state.gyroSensor.y,
        z: state.gyroSensor.z,
      });
    } else {
      finishCalibration();
    }
  }

  function onAbsReading() {
    if (!state.absSensor) return;
    state.absOrientLast = state.absSensor.quaternion;
    if (state.absOrientLast) {
      emitDebug({
        absQuat: {
          x: state.absOrientLast[0],
          y: state.absOrientLast[1],
          z: state.absOrientLast[2],
          w: state.absOrientLast[3],
        },
      });
    }
  }

  function runApplicationLogic(pitch, yaw, fov) {
    const requiredMode = fov < state.fovThreshold ? "gyro" : "absolute";
    if (requiredMode !== state.currentMode) {
      transitionToMode(requiredMode);
    }

    emitDebug({ activeSensorMode: state.currentMode });

    const sensitivity = state.currentMode === "gyro" ? 0.1 : 0.5;
    if (state.oldX === null || state.oldY === null) {
      state.oldX = yaw;
      state.oldY = pitch;
      return;
    }

    const adjustedYaw = unwrapAngle(yaw, state.oldX);
    state.oldX += (adjustedYaw - state.oldX) * sensitivity;
    state.oldY += (pitch - state.oldY) * sensitivity;
    updateView();
  }

  function transitionToMode(newMode) {
    if (newMode === "gyro" && state.currentMode === "absolute") {
      if (state.absOrientLast) {
        const euler = quaternionToEuler(state.absOrientLast);
        state.orient.pitch = euler.pitch;
        state.orient.yaw = euler.yaw;
        state.oldX = euler.yaw;
        state.oldY = euler.pitch;
      }
    } else if (newMode === "absolute" && state.currentMode === "gyro") {
      if (state.absOrientLast) {
        const euler = quaternionToEuler(state.absOrientLast);
        state.oldX = unwrapAngle(euler.yaw, state.oldX);
        state.oldY = euler.pitch;
      }
    }

    state.currentMode = newMode;
  }

  function onSensorReading() {
    emitDebug({
      gyro: {
        x: state.gyroSensor.x,
        y: state.gyroSensor.y,
        z: state.gyroSensor.z,
      },
    });

    if (state.calibrating) {
      state.lastTime = performance.now();
      return;
    }

    const now = performance.now();
    const dt = Math.max(1e-6, (now - state.lastTime) / 1000);
    state.lastTime = now;

    let currentV = 0.05;
    try {
      currentV = Math.exp(getLogFov());
    } catch {
      currentV = 0.05;
    }

    const inDynamicZone = currentV < state.dynamicThreshold;

    if (inDynamicZone) {
      const wx = state.gyroSensor.x - state.gyroBias.x;
      const wz = state.gyroSensor.z - state.gyroBias.z;
      const rawDeltaYaw = wz * dt;
      const rawDeltaPitch = wx * dt;
      const zoomRatio = currentV / state.dynamicThreshold;
      const speed = Math.hypot(rawDeltaYaw, rawDeltaPitch);
      const noiseFloor = 0.002;
      const precisionGain = speed < noiseFloor ? 0.05 : Math.min(1.0, Math.pow(speed * 100, 2));
      const totalFactor = zoomRatio * precisionGain * state.dynamicGainMultiplier;

      if (state.rawDynamicX === null) {
        state.rawDynamicX = state.oldX;
        state.rawDynamicY = state.oldY;
      }

      state.rawDynamicX += rawDeltaYaw * totalFactor;
      state.rawDynamicY += rawDeltaPitch * totalFactor;

      const k = state.dynamicSmoothingFactor;
      state.oldX += (state.rawDynamicX - state.oldX) * k;
      state.oldY += (state.rawDynamicY - state.oldY) * k;
      state.orient.yaw = state.oldX;
      state.orient.pitch = state.oldY;
      emitDebug({ activeSensorMode: "dynamic", activeSource: "gyroscope" });
      emitCoords(state.oldX, state.oldY);
      updateView();
      return;
    }

    state.rawDynamicX = null;
    state.rawDynamicY = null;

    if (state.currentMode === "absolute" && state.absOrientLast) {
      const euler = quaternionToEuler(state.absOrientLast);
      state.orient.pitch = euler.pitch;
      state.orient.yaw = euler.yaw;
      emitDebug({ activeSource: "absolute-orientation" });
    } else {
      let wx = state.gyroSensor.x - state.gyroBias.x;
      let wz = state.gyroSensor.z - state.gyroBias.z;
      if (Math.abs(wx) < state.gyroDeadzone) wx = 0;
      if (Math.abs(wz) < state.gyroDeadzone) wz = 0;
      state.orient.pitch += wx * dt;
      state.orient.yaw += wz * dt;
      emitDebug({ activeSource: "gyroscope" });
    }

    emitCoords(state.orient.yaw, state.orient.pitch);
    runApplicationLogic(state.orient.pitch, state.orient.yaw, currentV);
  }

  async function requestIOSPermissionIfNeeded() {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      await DeviceOrientationEvent.requestPermission();
    }
  }

  async function startSensors() {
    try {
      await requestIOSPermissionIfNeeded();
      if (!("Gyroscope" in window) || !("RelativeOrientationSensor" in window)) {
        throw new Error("Required sensors not available");
      }

      state.gyroSensor = new Gyroscope({ frequency: state.gyroFreq });
      state.absSensor = new RelativeOrientationSensor({ frequency: state.absFreq });
      state.absSensor.addEventListener("reading", onAbsReading);
      startCalibration();
    } catch (error) {
      onError(error);
      emitDebug({ activeSource: "sensor-error" });
    }
  }

  function startCalibration() {
    if (!state.gyroSensor || !state.absSensor) return;

    onCalibrationVisibility(true);
    state.calibrating = true;
    state.running = false;

    state.gyroSensor.removeEventListener("reading", onSensorReading);
    state.gyroSensor.removeEventListener("reading", onCalibReading);

    state.biasSamples = [];
    state.calibSamplesNeeded = state.gyroFreq * state.calibDuration;
    state.currentMode = "absolute";
    emitDebug({ calibrating: true, activeSource: "calibration" });

    state.gyroSensor.addEventListener("reading", onCalibReading);
    state.gyroSensor.start();
    state.absSensor.start();
  }

  function cancelCalibration() {
    if (!state.calibrating) return;

    state.calibrating = false;
    state.running = true;
    onCalibrationVisibility(false);

    if (state.gyroSensor) {
      state.gyroSensor.removeEventListener("reading", onCalibReading);
      state.gyroSensor.removeEventListener("reading", onSensorReading);
      state.gyroSensor.addEventListener("reading", onSensorReading);
    }

    if (state.absOrientLast) {
      const euler = quaternionToEuler(state.absOrientLast);
      state.oldX = euler.yaw;
      state.oldY = euler.pitch;
      state.orient.yaw = euler.yaw;
      state.orient.pitch = euler.pitch;
    }

    state.lastTime = performance.now();
    emitDebug({ calibrating: false, activeSource: "calibration-cancelled" });
  }

  function start( calibrateOnStart = true ) {
    if (calibrateOnStart) {
        emitDebug({ activeSource: "sensor-start" });
        startSensors();
    }
  }

  function stop() {
    state.running = false;
    state.calibrating = false;

    if (state.gyroSensor) {
      try {
        state.gyroSensor.stop();
      } catch {
        // no-op
      }
    }

    if (state.absSensor) {
      try {
        state.absSensor.stop();
      } catch {
        // no-op
      }
    }
  }

  return {
    start,
    stop,
    startCalibration,
    cancelCalibration,
  };
}