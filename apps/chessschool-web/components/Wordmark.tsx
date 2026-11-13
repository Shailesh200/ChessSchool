export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  const px = size === "lg" ? 48 : 32;
  return (
    <span className={`wordmark wordmark-${size}`}>
      <img src="/assets/raster/favicon-48.png" alt="" width={px} height={px} />
      <span>
        Chess<span className="wordmark-accent">School</span>
      </span>
    </span>
  );
}
