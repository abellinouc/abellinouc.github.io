import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import "./StellariumCanvas.css";

interface CityData {
  lat: number;
  lon: number;
  elev?: number;
  tz?: number;
}

const toJulianDateIso = (isoDateStr: string) => {
  const date = new Date(isoDateStr);
  const jd = date.getTime() / 86400000 + 2440587.5;
  return jd - 2400000.5; // MJD
};

const StellariumCanvas = forwardRef<any>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stelRef = useRef<any>(null);
  const clockInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://telescope.alessiobellino.com/stellarium-web-engine.js";
    script.async = true;

    script.onload = () => {
      const StelWebEngine = (window as any).StelWebEngine;

      if (!StelWebEngine || !canvasRef.current) {
        console.error("StelWebEngine no está disponible");
        return;
      }

      StelWebEngine({
        wasmFile:
          "https://telescope.alessiobellino.com/stellarium-web-engine.wasm",
        canvas: canvasRef.current,
        onReady: (stel: any) => {
          stelRef.current = stel;

          const core = stel.core;

          core.observer.latitude = -33.4489 * (Math.PI / 180); // Santiago
          core.observer.longitude = -70.6693 * (Math.PI / 180);
          core.observer.elevation = 570;
          core.observer.name = "Santiago, Chile";

          const baseUrl =
            "https://telescope.alessiobellino.com/stardata/cache/";

          core.stars.addDataSource({
            url: baseUrl + "surveys/gaia/v1",
            key: "gaia",
          });
          core.dsos.addDataSource({
            url:
              baseUrl +
              "swe-data-packs/base/2020-09-01/base_2020-09-01_1aa210df/dso",
          });
          core.landscapes.addDataSource({
            url: baseUrl + "landscapes/v1/guereins",
            key: "guereins",
          });
          core.skycultures.addDataSource({
            url: baseUrl + "skycultures/v3/western",
            key: "western",
          });

          ["moon", "sun", "mars", "jupiter", "saturn"].forEach((planet) => {
            core.planets.addDataSource({
              url: baseUrl + `surveys/sso/${planet}/v1`,
              key: planet,
            });
          });

          (window as any).stellariumEngine = stel;
        },
      });
    };

    document.body.appendChild(script);

    return () => {
      if (clockInterval.current) clearInterval(clockInterval.current);
      document.body.removeChild(script);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getEngine: () => stelRef.current,

    applyLocation: (cityName: string, cities: Record<string, CityData>) => {
      const engine = stelRef.current;
      const data = cities[cityName];
      if (!engine || !data) return;

      engine.core.observer.latitude = data.lat * (Math.PI / 180);
      engine.core.observer.longitude = data.lon * (Math.PI / 180);
      engine.core.observer.elevation =
        typeof data.elev === "number" ? data.elev : 0;
      engine.core.observer.name = cityName;

      engine.core.observer.pitch = 0;
      engine.core.observer.yaw = 0;

      const localTime = new Date();
      engine.core.observer.utc = toJulianDateIso(localTime.toISOString());
    },

    setSpeed: (speed: number) => {
      if (!stelRef.current) return;

      if (clockInterval.current) {
        clearInterval(clockInterval.current);
        clockInterval.current = null;
      }

      if (speed > 0) {
        clockInterval.current = setInterval(() => {
          if (!stelRef.current) return;

          const simulatedSecondsPerStep = speed * 0.03;
          const jdStep = simulatedSecondsPerStep / 86400;
          stelRef.current.core.observer.utc += jdStep;
        }, 30);
      }
    },
  }));

  return (
    <div id="stel" className="stel-container">
      <canvas id="stel-canvas" ref={canvasRef} className="stel-canvas" />
    </div>
  );
});

export default StellariumCanvas;
