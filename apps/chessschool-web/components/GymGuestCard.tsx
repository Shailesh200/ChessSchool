"use client";

import { copy } from "@chessschool/design";
import { Button, Card, TopBar } from "@/components/ui";

/** Guests can look at the Gym, but games (bots and coach) wait for an account. */
export function GymGuestCard({ backHref }: { backHref?: string }) {
  return (
    <div className="page page-narrow">
      <TopBar title={copy.gym.title} back={Boolean(backHref)} backHref={backHref} />
      <Card>
        <h2 className="card-title">{copy.you.saveCard.title}</h2>
        <p className="muted">{copy.auth.signupBody}</p>
        <div className="sheet-actions">
          <Button href="/signup">{copy.auth.signup}</Button>
          <Button href="/login" variant="secondary">
            {copy.auth.login}
          </Button>
        </div>
      </Card>
    </div>
  );
}
