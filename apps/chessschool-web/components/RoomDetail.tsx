"use client";

import { copy, type RoomId } from "@chessschool/design";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import type { CodyAnimation, IconName } from "@chessschool/design";
import { ActionDock, Button, TopBar } from "./ui";

const ROOM_META: Record<RoomId, { icon: IconName; pose: CodyAnimation; tint: string }> = {
  play: { icon: "play", pose: "thinking", tint: "brand" },
  practice: { icon: "practice", pose: "proud", tint: "accent" },
  club: { icon: "club", pose: "love", tint: "gold" },
};

export function RoomDetail({ id }: { id: RoomId }) {
  const room = copy.rooms.list[id];
  const meta = ROOM_META[id];
  return (
    <div className="page page-narrow">
      <TopBar backHref="/gym" title={room.name} />
      <div className={`hero-strip is-stacked tint-${meta.tint}`}>
        <div className="hero-strip-art">
          <Cody animation={meta.pose} size={120} label={copy.a11y.mascot} />
          <span className="room-icon">
            <Icon name={meta.icon} size={28} />
          </span>
        </div>
        <h2>{room.promise}</h2>
        <p className="muted">{copy.rooms.detailBody}</p>
      </div>
      <ActionDock>
        <Button block href="/gym" icon="gym">
          {copy.rooms.detailCta}
        </Button>
      </ActionDock>
    </div>
  );
}
