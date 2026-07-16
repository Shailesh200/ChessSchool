import { useLocalSearchParams } from "expo-router";
import { AssistedPlayView } from "@/AssistedPlayView";

export default function AssistedPlayScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <AssistedPlayView variant={mode === "puzzle" ? "puzzle" : "full"} />;
}
