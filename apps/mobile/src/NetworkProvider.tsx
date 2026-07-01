import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

type NetworkCtx = {
  isConnected: boolean;
  /** Brief pulse when transitioning offline → online */
  backOnline: boolean;
};

const Ctx = createContext<NetworkCtx>({ isConnected: true, backOnline: false });

function connected(state: NetInfoState | null): boolean {
  if (!state) return true;
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [backOnline, setBackOnline] = useState(false);
  const wasConnected = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    const clearHide = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
    };

    const apply = (online: boolean) => {
      if (!mounted.current) {
        mounted.current = true;
        wasConnected.current = online;
        setIsConnected(online);
        return;
      }
      if (online && !wasConnected.current) {
        setBackOnline(true);
        clearHide();
        hideTimer.current = setTimeout(() => setBackOnline(false), 2800);
      }
      if (!online) {
        setBackOnline(false);
        clearHide();
      }
      wasConnected.current = online;
      setIsConnected(online);
    };

    void NetInfo.fetch().then((s) => apply(connected(s)));
    const unsub = NetInfo.addEventListener((s) => apply(connected(s)));
    return () => {
      unsub();
      clearHide();
    };
  }, []);

  return <Ctx.Provider value={{ isConnected, backOnline }}>{children}</Ctx.Provider>;
}

export function useNetwork(): NetworkCtx {
  return useContext(Ctx);
}
