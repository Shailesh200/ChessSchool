import { copy } from "@chessschool/design";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Button, Page, T, useToast } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useApp } from "@/lib/state";

/** Opened from a class share link: chessschool://join/CODE */
export default function JoinClass() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { state } = useApp();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const clean = (code ?? "").trim().toUpperCase();

  useEffect(() => {
    if (!state.account || !clean || done) return;
    api.joinClass(clean).then(() => {
      setDone(true);
      toast(copy.classroom.joined);
      router.replace("/class");
    }).catch((err) => toast(errorMessage(err)));
  }, [state.account, clean, done, toast]);

  if (!state.account) {
    return (
      <Page title={copy.classroom.title} banner={false} footer={<Button title={copy.you.saveCard.cta} onPress={() => router.push("/signup")} />}>
        <T role="body">{copy.classroom.needAccount}</T>
        <T role="heading">{clean}</T>
      </Page>
    );
  }
  return (
    <Page title={copy.classroom.title} banner={false}>
      <T role="body" color="textMuted">{copy.classroom.joined}</T>
    </Page>
  );
}
