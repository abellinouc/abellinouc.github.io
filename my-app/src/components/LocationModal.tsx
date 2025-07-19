import { useEffect, useState } from "react";
import "./LocationModal.css";

interface CityData {
  lat: number;
  lon: number;
  elev?: number;
  tz?: number;
}

interface LocationModalProps {
  onClose: () => void;
  onSave: (cityName: string) => void;
}

export default function LocationModal({ onClose, onSave }: LocationModalProps) {
  const [cities, setCities] = useState<Record<string, CityData>>({});

  useEffect(() => {
    fetch("/data/cities.json")
      .then((res) => res.json())
      .then((data: Record<string, CityData>) => setCities(data))
      .catch((err) => console.error("Error al cargar ciudades:", err));
  }, []);

  const handleCityClick = (cityName: string) => {
    onSave(cityName);
    onClose();
  };

  return (
    <div className="location-modal-backdrop">
      <div className="location-modal-sidebar">
        <h2 className="location-modal-title">Select location</h2>
        <ul className="city-list">
          {Object.keys(cities).map((cityName) => (
            <li key={cityName}>
              <button
                className="city-button"
                onClick={() => handleCityClick(cityName)}
              >
                {cityName}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div
        className="location-modal-overlay"
        onClick={onClose}
        aria-label="Cerrar modal al hacer clic fuera"
      />
    </div>
  );
}
