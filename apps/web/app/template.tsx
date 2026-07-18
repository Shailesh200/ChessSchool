/**
 * App Router `template` remounts on every navigation. Keep it a passthrough —
 * opacity route fades made the whole page flash/rehydrate on tab changes.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return children;
}
