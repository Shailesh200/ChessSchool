import { copy } from "@chessschool/design";
import { router } from "expo-router";
import { Cody } from "@/components/Lottie";
import { Button, Flow, T } from "@/components/ui";

export default function NotFound() {
  return (
    <Flow footer={<Button title={copy.system.notFoundCta} onPress={() => router.replace("/today")} />}>
      <Cody animation="oops" size={180} label={copy.a11y.mascot} />
      <T role="title" header center>
        {copy.system.notFoundTitle}
      </T>
      <T role="bodyLg" color="textMuted" center>
        {copy.system.notFoundBody}
      </T>
    </Flow>
  );
}
