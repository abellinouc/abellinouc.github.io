import { useEffect, useRef, useState } from "react";
import "./ConnectIframe.css";

export default function ConnectIframe() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const buttonProxyRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  // Escuchar mensajes desde el iframe para expandir o colapsar
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "expandIframe") {
        setExpanded(true);
      } else if (event.data?.type === "collapseIframe") {
        setExpanded(false);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Detectar clics fuera del iframe Y fuera del botón proxy
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (iframeRef.current && !iframeRef.current.contains(target)) {
        setExpanded(false);
        iframeRef.current.contentWindow?.postMessage(
          { type: "collapseIframe" },
          "*"
        );
      }
    }

    if (expanded) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [expanded]);

  return (
    <>
      {/* Este proxy simula la posición del botón real */}
      <div ref={buttonProxyRef} className="connect-button-proxy" />
      <iframe
        ref={iframeRef}
        src="/connect.html"
        title="Connect"
        className={`connect-iframe ${expanded ? "expanded" : ""}`}
      />
    </>
  );
}
