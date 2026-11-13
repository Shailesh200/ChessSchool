import { copy } from "@chessschool/design";
import { router } from "expo-router";
import { Button, Card, Page, T } from "@/components/ui";

/** Guests can look at the Gym, but games (bots and coach) wait for an account. */
export function GymGuestCard({ back = false }: { back?: boolean }) {
  return (
    <Page title={copy.gym.title} large={!back} back={back} banner={false}>
      <Card style={{ gap: 12 }}>
        <T role="heading">{copy.you.saveCard.title}</T>
        <T role="body" color="textMuted">
          {copy.auth.signupBody}
        </T>
        <Button title={copy.auth.signup} onPress={() => router.push("/signup")} />
        <Button title={copy.auth.login} variant="secondary" onPress={() => router.push("/login")} />
      </Card>
    </Page>
  );
}
