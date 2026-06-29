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
        <div style={{ fontSize: "3rem" }}>🛟</div>
        <h1 style={{ fontWeight: 800, fontSize: "1.5rem" }}>ChessSchool needs a restart</h1>
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
