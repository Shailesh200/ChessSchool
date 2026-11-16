import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { INVITE_KEY } from "@/lib/share";

/** An invite link opened in the app: remember the code (it is accepted when the friend has an account), then start as usual. */
export default function InviteLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const ok = typeof code === "string" && /^[2-9a-z]{6,12}$/.test(code);
    (ok ? AsyncStorage.setItem(INVITE_KEY, code) : Promise.resolve()).catch(() => {}).finally(() => setSaved(true));
  }, [code]);
  return saved ? <Redirect href="/" /> : null;
}
