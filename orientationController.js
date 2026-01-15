function unwrapAngle(angle, reference) {
  while (angle - reference > Math.PI) angle -= 2 * Math.PI;
  while (angle - reference < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

window.Orientation = {
  gyroFreq: 100,
  absFreq: 30,
  calibDuration: 3,

  fovThreshold: 0.8,
  dynamicThreshold: 0.05,
  gyroDeadzone: 0.003,

  dynamicGainMultiplier: 10.0,
  dynamicSmoothingFactor: 0.15,

  gyroSensor: null,
  absSensor: null,

  gyroBias: { x: 0, y: 0, z: 0 },
  biasSamples: [],
  calibSamplesNeeded: 300,

  orient: { yaw: 0, pitch: 0 },
  absOrientLast: null,

  currentMode: "absolute",
  running: false,
  calibrating: false,

  oldX: null,
  oldY: null,
  rawDynamicX: null,
  rawDynamicY: null,

  lastTime: null,

  quaternionToEuler(q) {
    if (!q) return { yaw: 0, pitch: 0 };
    const [x, y, z, w] = q;
    return {
      pitch: Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)),
      yaw: Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)),
    };
  },

  async start(engine) {
    this.engine = engine;

    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      await DeviceOrientationEvent.requestPermission();
    }

    this.gyroSensor = new Gyroscope({ frequency: this.gyroFreq });
    this.absSensor = new AbsoluteOrientationSensor({ frequency: this.absFreq });

    this.gyroSensor.addEventListener("reading", () => this.onGyro());
    this.absSensor.addEventListener("reading", () => {
      this.absOrientLast = this.absSensor.quaternion;
    });

    this.startCalibration();
  },

  startCalibration() {
    this.calibrating = true;
    this.biasSamples = [];
    this.calibSamplesNeeded = this.gyroFreq * this.calibDuration;

    this.gyroSensor.start();
    this.absSensor.start();
  },

  onGyro() {
    const now = performance.now();
    if (!this.lastTime) {
      this.lastTime = now;
      return;
    }

    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (this.calibrating) {
      this.biasSamples.push({
        x: this.gyroSensor.x,
        y: this.gyroSensor.y,
        z: this.gyroSensor.z,
      });

      if (this.biasSamples.length >= this.calibSamplesNeeded) {
        const avg = this.biasSamples.reduce(
          (a, b) => ({
            x: a.x + b.x,
            y: a.y + b.y,
            z: a.z + b.z,
          }),
          { x: 0, y: 0, z: 0 }
        );
        const n = this.biasSamples.length;
        this.gyroBias = { x: avg.x / n, y: avg.y / n, z: avg.z / n };
        this.calibrating = false;
      }
      return;
    }

    const fov = this.engine.core.fov;
    const dynamic = fov < this.dynamicThreshold;

    if (dynamic) {
      if (this.rawDynamicX === null) {
        this.rawDynamicX = this.oldX ?? 0;
        this.rawDynamicY = this.oldY ?? 0;
      }

      const wx = this.gyroSensor.x - this.gyroBias.x;
      const wz = this.gyroSensor.z - this.gyroBias.z;

      const factor = (fov / this.dynamicThreshold) * this.dynamicGainMultiplier;

      this.rawDynamicX += wz * dt * factor;
      this.rawDynamicY += wx * dt * factor;

      this.oldX += (this.rawDynamicX - this.oldX) * this.dynamicSmoothingFactor;
      this.oldY += (this.rawDynamicY - this.oldY) * this.dynamicSmoothingFactor;
    } else {
      this.rawDynamicX = null;
      this.rawDynamicY = null;

      if (this.absOrientLast) {
        const e = this.quaternionToEuler(this.absOrientLast);
        this.oldX = unwrapAngle(e.yaw, this.oldX ?? e.yaw);
        this.oldY = e.pitch;
      }
    }

    // 🔴 SALIDA DIRECTA A STELLARIUM
    this.engine.core.observer.yaw = this.oldX;
    this.engine.core.observer.pitch = this.oldY;
  },
};
