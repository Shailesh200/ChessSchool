"use client";

/** Last-resort boundary for errors in the root layout itself (#75). */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          background: "#fbfaff",
          color: "#1c1b2e",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <svg viewBox="0 0 24 24" width="48" height="48" aria-hidden style={{ color: "#d97706" }}>
          <path
            fill="currentColor"
            fillOpacity="0.16"
            d="M12 4 3.5 19h17z"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4 3.5 19h17zM12 10v4M12 17h.01"
          />
        </svg>
        <h1 style={{ fontWeight: 800, fontSize: "1.5rem" }}>
          ChessSchool needs a restart
        </h1>
        <p style={{ maxWidth: 320, color: "#6b6982", fontWeight: 600 }}>
          Your saved progress is safe on this device.
        </p>
        <button
          onClick={() => reset()}
          style={{
            height: 48,
            padding: "0 1.5rem",
            borderRadius: 999,
            background: "#5b5bd6",
            color: "#fff",
            fontWeight: 700,
            border: "none",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
