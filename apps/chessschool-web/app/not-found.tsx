import { copy } from "@chessschool/design";
import { StatusScreen } from "@/components/StatusScreen";

export default function NotFound() {
  return <StatusScreen pose="oops" title={copy.system.notFoundTitle} body={copy.system.notFoundBody} cta={copy.system.notFoundCta} href="/today" />;
}
