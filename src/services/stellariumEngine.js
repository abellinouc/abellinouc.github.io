const DEFAULT_BASE_URL = "https://smalldata.ventanaceleste.com/";
const DEFAULT_LOCATION = {
  cityName: "Santiago",
  lat: -33.4489,
  lon: -70.6693,
  elev: 570,
  mag: 17.13,
};

const PLANETS = [
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
];

function buildDataSources(baseUrl) {
  const dataSources = [
    {
      loader: "stars",
      config: {
        url: `${baseUrl}swe-data-packs/minimal/2020-09-01/minimal_2020-09-01_186e7ee2/stars`,
        key: "minimal",
      },
    },
    {
      loader: "stars",
      config: {
        url: `${baseUrl}swe-data-packs/base/2020-09-01/base_2020-09-01_1aa210df/stars`,
        key: "base",
      },
    },
    {
      loader: "landscapes",
      config: {
        url: `${baseUrl}landscapes/v1/guereins`,
        key: "guereins",
      },
    },
    {
      loader: "stars",
      config: {
        url: `${baseUrl}swe-data-packs/extended/2020-03-11/extended_2020-03-11_26aa5ab8/stars`,
        key: "extended",
      },
    },
    {
      loader: "dss",
      config: {
        url: `${baseUrl}surveys/gaia/v1`,
        key: "gaia",
      },
    },
    {
      loader: "skycultures",
      config: {
        url: `${baseUrl}skycultures/v3/western`,
        key: "western",
      },
    },
    {
      loader: "dsos",
      config: {
        url: `${baseUrl}swe-data-packs/base/2020-09-01/base_2020-09-01_1aa210df/dso`,
      },
    },
    {
      loader: "dsos",
      config: {
        url: `${baseUrl}swe-data-packs/extended/2020-03-11/extended_2020-03-11_26aa5ab8/dso`,
      },
    },
    {
      loader: "milkyway",
      config: {
        url: `${baseUrl}surveys/milkyway/v1`,
      },
    },
    {
      loader: "dss",
      config: {
        url: `${baseUrl}surveys/dss/v1`,
      },
    },
    {
      loader: "minor_planets",
      config: {
        url: `${baseUrl}mpc/v1/mpcorb.dat`,
        key: "mpc_asteroids",
      },
    },
    {
      loader: "comets",
      config: {
        url: `${baseUrl}mpc/v1/CometEls.txt?v=2019-12-17`,
        key: "mpc_comets",
      },
    },
  ];

  PLANETS.forEach((planet) => {
    dataSources.push({
      loader: "planets",
      config: {
        url: `${baseUrl}surveys/sso/${planet}/v1`,
        key: planet,
      },
    });
  });

  return dataSources;
}

export function ensureStellariumScript() {
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

export async function configureStellariumEngine(stel, { baseUrl = DEFAULT_BASE_URL, location = DEFAULT_LOCATION } = {}) {
  const { core } = stel;
  const now = new Date();

  core.observer.utc = now.getTime() / 86400000 + 2440587.5;
  core.observer.latitude = location.lat * (Math.PI / 180);
  core.observer.longitude = location.lon * (Math.PI / 180);
  core.observer.elevation = location.elev;

  const dataSourcePromises = buildDataSources(baseUrl).map(({ loader, config }) => {
    return core[loader].addDataSource(config);
  });

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

  return stel;
}

export async function initializeStellariumEngine({
  canvas,
  wasmFile = "/stellarium-web-engine.wasm",
  baseUrl = DEFAULT_BASE_URL,
  location = DEFAULT_LOCATION,
  onReady = () => {},
  onError = () => {},
} = {}) {
  await ensureStellariumScript();

  if (typeof window.StelWebEngine !== "function") {
    throw new Error("Stellarium engine script not available");
  }

  return new Promise((resolve, reject) => {
    window.StelWebEngine({
      wasmFile,
      canvas,
      async onReady(stel) {
        try {
          window.currentStelEngine = stel;
          await configureStellariumEngine(stel, { baseUrl, location });
          await onReady(stel);
          resolve(stel);
        } catch (error) {
          onError(error);
          reject(error);
        }
      },
    });
  });
}