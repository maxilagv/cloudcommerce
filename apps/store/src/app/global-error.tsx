"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: only fires if the root layout itself throws.
 * Must render its own <html>/<body> — Tailwind utilities aren't guaranteed
 * to be safe here, so this uses inline styles deliberately.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#f6f8fb",
          color: "#101828",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#eaf3ff",
            display: "grid",
            placeItems: "center",
          }}
        >
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#0b6bff" }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
          Algo salió mal
        </h1>
        <p style={{ fontSize: 14, color: "#475467", maxWidth: 380, margin: 0 }}>
          Tuvimos un problema inesperado. Probá recargar la página.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            height: 44,
            padding: "0 20px",
            borderRadius: 999,
            border: "none",
            background: "#0b6bff",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
