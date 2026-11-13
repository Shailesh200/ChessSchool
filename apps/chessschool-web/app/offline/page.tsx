import { copy } from "@chessschool/design";
import { StatusScreen } from "@/components/StatusScreen";

export default function OfflinePage() {
  return <StatusScreen pose="sleepy" title="You're offline." body={copy.system.offline} cta={copy.system.notFoundCta} href="/today" />;
}
