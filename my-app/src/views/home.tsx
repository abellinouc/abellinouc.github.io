import React, { useState, useRef, useEffect } from "react";
import StellariumCanvas from "../components/StellariumCanvas";
import LocationModal from "../components/LocationModal";
import TopBar from "../components/TopBar";
import EngineButtons from "../components/EngineButtons";
import TimeModal from "../components/TimeModal";
import ConnectIframe from "../components/ConnectIframe";

interface CityData {
  lat: number;
  lon: number;
  elev?: number;
  tz?: number;
}

export default function Home() {
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [cities, setCities] = useState<Record<string, CityData>>({});
  const stelRef = useRef<any>(null);

  // Estado para controlar fecha y velocidad sincronizados
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentSpeed, setCurrentSpeed] = useState<number>(1);

  // Cargar ciudades solo una vez
  useEffect(() => {
    fetch("/data/cities.json")
      .then((res) => res.json())
      .then((data: Record<string, CityData>) => setCities(data))
      .catch((err) => console.error("Error al cargar ciudades:", err));
  }, []);

  // Función para convertir ISO string a Julian Date (Modified Julian Date)
  function toJulianDateIso(iso: string) {
    const now = new Date(iso);
    const jd = now.getTime() / 86400000 + 2440587.5; // Julian Date
    const mjd = jd - 2400000.5; // Modified Julian Date
    return mjd;
  }

  // Actualizar localización con ref StellariumCanvas
  const handleSetLocation = (cityName: string) => {
    if (!stelRef.current) return;
    stelRef.current.applyLocation(cityName, cities);
    setShowLocationModal(false);
  };

  // Cambiar fecha: actualizar estado React y motor Stellarium
  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
    if (!stelRef.current) return;

    // Ajuste de UTC considerando zona horaria local
    const utcDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    const engine = stelRef.current.getEngine();
    if (engine) {
      engine.core.observer.utc = toJulianDateIso(utcDate.toISOString());
    }
  };

  // Cambiar velocidad: actualizar estado React y motor Stellarium
  const handleSpeedChange = (speed: number) => {
    setCurrentSpeed(speed);
    if (!stelRef.current) return;

    // Asumiendo stelRef.current.setSpeed implementa la lógica de velocidad y timers
    stelRef.current.setSpeed(speed);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white">
      <TopBar
        onLocationClick={() => setShowLocationModal(true)}
        onTimeClick={() => setShowTimeModal(true)}
      />

      <ConnectIframe />

      <StellariumCanvas ref={stelRef} />

      <EngineButtons />

      {showLocationModal && (
        <LocationModal
          onClose={() => setShowLocationModal(false)}
          onSave={handleSetLocation}
        />
      )}

      {showTimeModal && (
        <TimeModal
          onClose={() => setShowTimeModal(false)}
          currentDate={currentDate}
          currentSpeed={currentSpeed}
          onDateChange={handleDateChange}
          onSpeedChange={handleSpeedChange}
          getJulianDate={() =>
            stelRef.current?.getEngine()?.core.observer.utc ?? 0
          }
        />
      )}
    </div>
  );
}
