/** Portrait tag. Loaded with ssr:false so the settings HTML does not preload it. */
export default function CoachAvatarImage({
  src,
  alt,
  px,
}: {
  src: string;
  alt: string;
  px: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="coach-avatar__img"
      src={src}
      alt={alt}
      width={px}
      height={px}
      draggable={false}
      loading="lazy"
      fetchPriority="low"
    />
  );
}
