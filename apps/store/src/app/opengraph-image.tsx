import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;

/** Default Open Graph card for every page without its own image. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background:
            "radial-gradient(circle at 82% 18%, rgba(255,255,255,0.16), transparent 40%), linear-gradient(135deg, #0B6BFF 0%, #004ECC 100%)",
          color: "#FFFFFF",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.14)",
              borderRadius: 24,
              border: "2px solid rgba(255,255,255,0.35)",
            }}
          >
            <svg width="56" height="56" viewBox="0 0 512 512" fill="none">
              <path
                d="M354 322c36 0 66-29 66-65 0-33-25-61-58-65-8-54-55-96-111-96-49 0-91 31-106 75-38 4-67 36-67 74 0 42 34 77 76 77h200z"
                stroke="#FFFFFF"
                strokeWidth="34"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05 }}>
            {SITE_TAGLINE}
          </div>
          <div style={{ fontSize: 30, opacity: 0.85 }}>
            Electrónica y electrodomésticos · Envíos a todo el país · Garantía oficial
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 26,
            opacity: 0.9,
          }}
        >
          www.cloudcommerce.com.ar
        </div>
      </div>
    ),
    size,
  );
}
