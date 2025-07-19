import { useState } from "react";
import "./EngineButtons.css";

type ButtonDef = {
  label: string;
  img: string;
  path: string;
  attr: string;
};

const BUTTONS: ButtonDef[] = [
  {
    label: "Constellations",
    img: "https://telescope.alessiobellino.com/svg/btn-cst-lines.svg",
    path: "constellations",
    attr: "lines_visible",
  },
  {
    label: "Atmosphere",
    img: "https://telescope.alessiobellino.com/svg/btn-atmosphere.svg",
    path: "atmosphere",
    attr: "visible",
  },
  {
    label: "Landscape",
    img: "https://telescope.alessiobellino.com/svg/btn-landscape.svg",
    path: "landscapes",
    attr: "visible",
  },
  {
    label: "Azimuthal Grid",
    img: "https://telescope.alessiobellino.com/svg/btn-azimuthal-grid.svg",
    path: "lines.azimuthal",
    attr: "visible",
  },
  {
    label: "Equatorial Grid",
    img: "https://telescope.alessiobellino.com/svg/btn-equatorial-grid.svg",
    path: "lines.equatorial",
    attr: "visible",
  },
  {
    label: "Nebulae",
    img: "https://telescope.alessiobellino.com/svg/btn-nebulae.svg",
    path: "dsos",
    attr: "visible",
  },
  {
    label: "DSS",
    img: "https://telescope.alessiobellino.com/svg/btn-nebulae.svg",
    path: "dss",
    attr: "visible",
  },
];

export default function EngineButtons() {
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});

  const toggleFeature = (btn: ButtonDef) => {
    const engine = (window as any).stellariumEngine;
    if (!engine) return;

    const pathParts = btn.path.split(".");
    let obj = engine.core;
    for (const part of pathParts) {
      if (obj[part]) {
        obj = obj[part];
      } else {
        console.warn(`Path not found: ${btn.path}`);
        return;
      }
    }

    const current = obj[btn.attr];
    obj[btn.attr] = !current;

    setActiveStates((prev) => ({
      ...prev,
      [btn.path + "." + btn.attr]: !current,
    }));
  };

  return (
    <div className="engine-buttons-container">
      {BUTTONS.map((btn) => {
        const isActive = activeStates[btn.path + "." + btn.attr];
        return (
          <div
            key={btn.label}
            className={`engine-button ${isActive ? "active" : ""}`}
            onClick={() => toggleFeature(btn)}
            title={btn.label}
          >
            <img src={btn.img} alt={btn.label} className="engine-button-img" />
          </div>
        );
      })}
    </div>
  );
}
