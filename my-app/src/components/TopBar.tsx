import "./TopBar.css";

interface TopBarProps {
  onLocationClick: () => void;
  onTimeClick: () => void;
}

export default function TopBar({ onLocationClick, onTimeClick }: TopBarProps) {
  return (
    <div className="topbar">
      <div className="topbar-content">
        <h1 className="topbar-title">Stellarium Web</h1>
        <div className="topbar-buttons">
          <button onClick={onLocationClick} className="topbar-button">
            Location
          </button>
          <button onClick={onTimeClick} className="topbar-button">
            Date & Time
          </button>
        </div>
      </div>
    </div>
  );
}
