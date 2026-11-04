"use client";

import { copy, type CodyAnimation } from "@chessschool/design";
import { Cody } from "./Lottie";
import { Button } from "./ui";

export function StatusScreen({ pose, title, body, cta, href, onAction }: { pose: CodyAnimation; title: string; body: string; cta: string; href?: string; onAction?: () => void }) {
  return (
    <div className="flow">
      <div className="flow-body">
        <Cody animation={pose} size={180} label={copy.a11y.mascot} />
        <h1>{title}</h1>
        <p className="lead">{body}</p>
      </div>
      <footer className="flow-actions">
        <Button block href={href} onClick={onAction}>
          {cta}
        </Button>
      </footer>
    </div>
  );
}
