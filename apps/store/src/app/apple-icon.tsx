import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — solid background (iOS applies its own mask). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1E86FF 0%, #004ECC 100%)",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 512 512" fill="none">
          <path
            d="M354 322c36 0 66-29 66-65 0-33-25-61-58-65-8-54-55-96-111-96-49 0-91 31-106 75-38 4-67 36-67 74 0 42 34 77 76 77h200z"
            stroke="#FFFFFF"
            strokeWidth="30"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
