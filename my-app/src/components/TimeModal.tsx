import { useEffect, useRef, useState } from "react";
import flatpickr from "flatpickr";
import "./TimeModal.css"; // Importamos el CSS externo

interface TimeModalProps {
  onClose: () => void;
  currentDate: Date;
  currentSpeed: number;
  onDateChange: (date: Date) => void;
  onSpeedChange: (speed: number) => void;
  getJulianDate: () => number;
}

function fromMJDToDate(mjd: number): Date {
  const jd = mjd + 2400000.5;
  return new Date((jd - 2440587.5) * 86400000);
}

export default function TimeModal({
  onClose,
  currentDate,
  currentSpeed,
  onDateChange,
  onSpeedChange,
  getJulianDate,
}: TimeModalProps) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const fpInstance = useRef<any>(null);
  const [selectedSpeed, setSelectedSpeed] = useState(currentSpeed);
  const lastManualChange = useRef(0);
  const isUserTouchingCalendar = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (calendarRef.current) {
      fpInstance.current = flatpickr(calendarRef.current, {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        defaultDate: currentDate,
        inline: true,
        onOpen: () => {
          isUserTouchingCalendar.current = true;
        },
        onClose: () => {
          isUserTouchingCalendar.current = false;
        },
        onChange: (selectedDates) => {
          if (selectedDates.length) {
            lastManualChange.current = Date.now();
            onDateChange(selectedDates[0]);
          }
        },
      });
    }

    intervalRef.current = setInterval(() => {
      if (
        fpInstance.current &&
        !isUserTouchingCalendar.current &&
        Date.now() - lastManualChange.current > 2000
      ) {
        const jd = getJulianDate();
        if (!jd) return;
        const date = fromMJDToDate(jd);
        fpInstance.current.setDate(date, false);
      }
    }, 300);

    return () => {
      if (fpInstance.current) {
        fpInstance.current.destroy();
        fpInstance.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const handleSpeedChange = (speed: number) => {
    setSelectedSpeed(speed);
    onSpeedChange(speed);
  };

  return (
    <div className="time-modal">
      <div className="time-modal-header">
        <h2>Select Date and Time</h2>
        <button onClick={onClose} aria-label="Cerrar" className="close-btn">
          ✕
        </button>
      </div>
      <div ref={calendarRef} className="calendar" />

      <div className="time-control-buttons">
        {[0, 1].map((speed) => (
          <button
            key={speed}
            onClick={() => handleSpeedChange(speed)}
            className={`speed-btn ${selectedSpeed === speed ? "selected" : ""}`}
          >
            {speed === 0 ? "🟥 Stop" : "🕒 Realtime"}
          </button>
        ))}
      </div>

      <div className="speed-control-buttons">
        {[10, 60, 3600].map((speed) => (
          <button
            key={speed}
            onClick={() => handleSpeedChange(speed)}
            className={`speed-btn ${selectedSpeed === speed ? "selected" : ""}`}
          >
            ⏩ {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}
