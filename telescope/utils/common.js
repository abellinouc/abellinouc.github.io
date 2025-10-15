import initializeStelEngine from "../../util/initStel.js";
import { addZoomSliderEvent } from './events.js';
import { updateDisplayFov } from './updateDisplay.js';
import { closeMenu, createMenuElement, openMenu, optionSelection } from '../Menu/menu.js';
import { applyCurrentDate, displayDateTime, setSpeed } from '../Menu/DateTime/datetime.js';
import { displayGlobe } from "../Menu/Location/globe.js";
import { getMagFromLonLat } from "./lp/getLpFromCoords.js";
import { getUtcOffset, updateTimeZone } from "../Menu/Location/location.js";
import { applyLocation } from "../../util/location.js";

function loadScript(url, type) {    
    const head = document.getElementsByTagName('head')[0];
    const script = document.createElement('script');
    script.type = type;
    script.src = url;
    head.appendChild(script);
}

async function loadScentialScripts() {
  let paths = [
    // { path: "telescope/utils/updateDisplay.js", type: 'module'},
    // { path: "telescope/Slider/slider.js", type: 'module'},
    { path: "telescope/utils/stellarium.js", type: 'module'},
    // { path: "telescope/utils/events.js", type: 'module'},
    // { path: "util/time.js", type: 'module'},
  ]

  paths.forEach((content) => {
    loadScript(content.path, content.type);
  })
}

async function loadExtraScripts() {
  let paths = [
    { path: "https://unpkg.com/three", type: 'module' },
    { path: "https://cesium.com/downloads/cesiumjs/releases/1.133/Build/Cesium/Cesium.js", type: 'text/javascript' },
    { path: "https://unpkg.com/browser-geo-tz@latest/dist/geotz.js", type: 'text/javascript' },
    // { path: "https://cdn.jsdelivr.net/npm/flatpickr", type: 'text/javascript' },
    { path: "https://unpkg.com/globe.gl", type: 'text/javascript' },
    { path: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", type: 'text/javascript' },
    { path: "telescope/utils/lp/pako_inflate.min.js", type: 'text/javascript' },
    { path: "telescope/utils/lp/getLpFromCoords.js", type: 'text/javascript' },
    { path: "telescope/Menu/DateTime/datetime.js", type: 'module' },
    { path: "telescope/Menu/Location/location.js", type: 'module' },
    { path: "telescope/Menu/Location/globe.js", type: 'text/javascript' },
    { path: "telescope/Menu/Seeing/seeing.js", type: 'module' },
    { path: "telescope/Menu/Pollution/pollution.js", type: 'module' },
    { path: "telescope/utils/luxon.js", type: 'text/javascript' },
    { path: "util/Control.Geocoder.js", type: 'text/javascript' },
    { path: "util/L.Control.Range.js", type: 'text/javascript' },
    { path: "limit_mag/limit_magnitude.js", type: 'module' },
    { path: "util/overlay.js", type: 'module' },
    { path: "util/location.js", type: 'module' },
    { path: "util/stel.js", type: 'module' },
    { path: "telescope/utils/tz.js", type: 'text/javascript' },
  ]

  paths.forEach((content) => {
    loadScript(content.path, content.type);
  })
}

function setLoading(state = true) {
  if (state === true) mainLoadingScreenElement.style.display = 'block';
  else mainLoadingScreenElement.style.display = 'none';
}

function setModeSettings(mode) {
  // viewControlsButton.disabled = mode == 'simple';
  Protobject.Core.send({ msg: `${mode}Settings`, values: {} }).to(
    "index.html"
  );
}

function toggleMode() {
  // Cambiar a avanzado
  if (modes.simple === true) {
    if (!advancedModeElement) {
      advancedModeElement = document.getElementById('advancedMode');
    }
    modeTextElement.textContent = 'Simple';
    advancedModeElement.classList.add("active");
    simpleModeElement.classList.remove("active");
    modeButtonElement.classList.add("simple-mode-image");
    modeButtonElement.classList.remove("advanced-mode-image");
  }
  // Cambiar a simple
  else {
    if (!simpleModeElement) {
      simpleModeElement = document.getElementById('simpleMode');
    }
    modeTextElement.textContent = 'Avanzado';
    simpleModeElement.classList.add("active");
    advancedModeElement.classList.remove("active");
    modeButtonElement.classList.add("advanced-mode-image");
    modeButtonElement.classList.remove("simple-mode-image");
  }

  // Intercambiar modo activo
  for (let mode in modes) {
    modes[mode] = !modes[mode];
    if (modes[mode] == true) {
      setModeSettings(mode);
    }
  }

}

function enableFinderMode() {
  if (advancedModeWarningText === undefined) {
    advancedModeWarningText = document.querySelector(
      "#advancedMode .alert-text"
    );
  }
  const buttons = document.querySelectorAll("#lensContainer button");

  advancedModeWarningText.style.opacity = 1;
  buttons.forEach((btn) => {
    btn.disabled = true;
  });
}

function disableFinderMode() {
  if (advancedModeWarningText === undefined) {
    advancedModeWarningText = document.querySelector(
      "#advancedMode .alert-text"
    );
  }
  advancedModeWarningText.style.opacity = 0;

  const buttons = document.querySelectorAll("#lensContainer button");

  buttons.forEach((btn) => {
    btn.disabled = false;
  });
}

function updateBlur(direction = 1) {
  currentBlur += direction * 0.001;
  currentBlur = Math.max(0, Math.min(10, currentBlur));

  updateDisplayBlur();
}

function autoPollution() {
  if (autoPollutionCheckbox.checked == true) {
    pollutionInput.style.opacity = 0;
    pollutionInput.style.pointerEvents = "none";
  } else {
    pollutionInput.style.opacity = 1;
    pollutionInput.style.pointerEvents = "auto";
  }
}

function unwrapAngle(newAngle, prevAngle) {
  let delta = newAngle - prevAngle;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  return prevAngle + delta;
}


function toggleZoomOptions() {
  zoomOptions.classList.toggle('visible');
}


function applyZoom(selected_eyepiece_fl, event) {
  const button = document.querySelector(
    '#lensContainer .active'
  );

  if (button) {
    button.classList.toggle('active')
  }

  event.target.classList.toggle('active');
  
  EYEPIECE_FL = selected_eyepiece_fl;

  // Calcular nuevo FOV

  const m = FOCAL_LENGTH / EYEPIECE_FL; // Magnification
  const proyection_const = 100; // Ni idea de porqué es 100, pero asi funciona
  
  // new_fov es fov de stellarium, no fov aparente del ocular
  
  let new_fov = (proyection_const / m)
  // Convertir a radianes
  new_fov = new_fov * Math.PI / 180;
  
  logFov = new_fov;
  updateDisplayFov();
}

function bortleToMag(bortle) {

  switch (bortle) {
    case 1:
      return (22.0 + 21.99) / 2 + Math.random() * 0.1; // Cielo prístino
    case 2:
      return (21.99 + 21.89) / 2 + Math.random() * 0.1; // Cielo excelente
    case 3:
      return (21.89 + 21.69) / 2 + Math.random() * 0.2; // Cielo rural
    case 4:
      return (21.69 + 20.49) / 2 + Math.random() * 1.2; // Suburbano oscuro
    case 5:
      return (20.49 + 19.5) / 2 + Math.random() * 0.99; // Suburbano intermedio
    case 6:
      return (19.5 + 18.94) / 2 + Math.random() * 0.56; // Suburbano brillante
    case 7:
      return (18.94 + 18.38) / 2 + Math.random() * 0.56; // Periurbano
    case 8:
      return (18.38 + 16.53) / 2 + Math.random() * 1.85; // Ciudad
    case 9:
      return (16.53 + 15.0) / 2 + Math.random() * 1.53; // Centro de Ciudad
    default:
      return null;
  }
}

function updatePollution() {
  if (!pollutionInput) return;

  pollutionInput.value = pollution;
}

function setWindowFunctions() {
  window.toggleMode = toggleMode;
  window.applyZoom = applyZoom;
  window.updateDisplayFov = updateDisplayFov;
  window.autoPollution = autoPollution;
  window.openMenu = openMenu;
  window.setLoading = setLoading;
  window.closeMenu = closeMenu;
  window.displayDateTime = displayDateTime;
  window.displayGlobe = displayGlobe;
  window.optionSelection = optionSelection;
  window.bortleToMag = bortleToMag;
  window.getMagFromLonLat = getMagFromLonLat;
  window.getUtcOffset = getUtcOffset;
  window.updateTimeZone = updateTimeZone;
  window.updatePollution = updatePollution;
  window.applyLocation = applyLocation;
  window.setSpeed = setSpeed;
  window.applyCurrentDate = applyCurrentDate;
  window.unwrapAngle = unwrapAngle;
}

function addMenuElement() {
  const element = document.getElementById('startContainer');
  const menuElement = createMenuElement();
  element.after(menuElement);
  const pollutionInput = document.getElementById("pollutionSlider");
  window.pollutionInput = pollutionInput;
  window.menu = menuElement;
  window.interactionSection = document.getElementById('interactionSection');
  window.menuLoadingElement = document.getElementById('menuLoadingScreen');
  setStellariumOptionButtons();
}

function setStellariumOptionButtons() {
  const stellariumOptionButtons = document.querySelectorAll(
    "#stellariumOptionsContainer button"
  );
  
  stellariumOptionButtons.forEach((btn) => {
    btn.onclick = () => {
      const info = BUTTONS[btn.name];
      Protobject.Core.send({
        msg: "stellariumOption",
        values: { path: info.path, attr: info.attr },
      }).to("index.html");
      btn.classList.toggle("active");
    };
  });
}





/**************************  CÓDIGO  *************************************/

window.oldFov = 3;
window.MIN_FOV = 0.000005;
window.MAX_FOV = 3.228859;
window.FOV_STEP = 0.000001;
window.minLogFov = Math.log(MIN_FOV);
window.maxLogFov = Math.log(MAX_FOV);
window.logFov = maxLogFov;
window.current_fov = 3;

window.currentBlur = 5;
window.blurTarget = currentBlur;

window.engine = null;
window.bortle = null;

window.currentLat = null;
window.currentLon = null;
window.currentElev = null;
window.currentTZ = -4;

window.pollution = 9;

window.engineUTC = null;
window.timeSpeed = 0;
window.activeFlatpickr = null;
window.flatpickrSyncInterval = null;
window.lastManualChange = 0;
window.isUserTouchingCalendar = false;

const BUTTONS = {
  constellations: {
    label: "Constellations",
    img: "https://telescope.alessiobellino.com/svg/btn-cst-lines.svg",
    path: "constellations",
    attr: "lines_visible",
  },
  atmosphere: {
    label: "Atmosphere",
    img: "https://telescope.alessiobellino.com/svg/btn-atmosphere.svg",
    path: "atmosphere",
    attr: "visible",
  },
  landscape: {
    label: "Landscape",
    img: "https://telescope.alessiobellino.com/svg/btn-landscape.svg",
    path: "landscapes",
    attr: "visible",
  },
  azimuthal: {
    label: "Azimuthal Grid",
    img: "https://telescope.alessiobellino.com/svg/btn-azimuthal-grid.svg",
    path: "lines.azimuthal",
    attr: "visible",
  },
  equatorial: {
    label: "Equatorial Grid",
    img: "https://telescope.alessiobellino.com/svg/btn-equatorial-grid.svg",
    path: "lines.equatorial",
    attr: "visible",
  },
  nebulae: {
    label: "Nebulae",
    img: "https://telescope.alessiobellino.com/svg/btn-nebulae.svg",
    path: "dsos",
    attr: "visible",
  },
  dss: {
    label: "DSS",
    img: "https://telescope.alessiobellino.com/svg/btn-nebulae.svg",
    path: "dss",
    attr: "visible",
  },
};

let modes = {
  simple: true,
  advanced: false
}

let modeContainer;
let blurSlider;
let zoomSlider;
let simpleModeElement = null;
let advancedModeElement = null;
window.mainLoadingScreenElement = null;
let modeTextElement;
let modeButtonElement;

async function main() {
  await loadScentialScripts();
  // setTimeout(() => loadExtraScripts(), 1000);

  mainLoadingScreenElement = document.getElementById('mainLoadingScreen');

  // Esperar carga del DOM
  document.addEventListener("DOMContentLoaded", () => {
    // console.log("DOM is ready!");
    
    addMenuElement();

    modeContainer = document.getElementById('modeContent');
    modeButtonElement = document.getElementById('modeButton');
    
    // blurSlider = document.getElementById("focusSlider");
    zoomSlider = document.getElementById("zoomSlider");
    
    simpleModeElement = document.getElementById("simpleMode");
    // advancedModeElement = document.getElementById("advancedMode");

    modeTextElement = document.getElementById('modeText');

    simpleModeElement.classList.toggle("active");
    modeButtonElement.classList.toggle("simple-mode-image");
    modeTextElement.textContent = 'Avanzado';

    addZoomSliderEvent(zoomSlider);
    setWindowFunctions();
    initializeStelEngine(true);
    setLoading(false);
    
  });
  
  
  
  // blurSlider.value = currentBlur;
  // updateDisplayFov();
}

main();
