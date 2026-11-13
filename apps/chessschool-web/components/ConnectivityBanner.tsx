"use client";

import { copy } from "@chessschool/design";
import { useConnectivity } from "@/lib/hooks";
import { Icon } from "./Icon";

export function ConnectivityBanner() {
  const { status, retry } = useConnectivity();
  if (status === "online") return null;
  return (
    <div className="banner" role="status">
      <Icon name="wifiOff" />
      <p>{status === "offline" ? copy.system.offline : copy.system.apiDown}</p>
      {status === "api-down" ? (
        <button className="banner-btn" onClick={retry}>
          {copy.system.retry}
        </button>
      ) : null}
    </div>
  );
}
