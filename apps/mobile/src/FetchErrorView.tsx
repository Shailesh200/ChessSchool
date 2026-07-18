import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Cody } from "./Cody";
import { Button } from "./Button";
import { useType } from "./typography";
import { colors, font, space } from "./theme";

export function FetchErrorView({
  title = "Couldn't load",
  message = "Check your connection and try again.",
  onRetry,
  onBack,
  backLabel = "Go back",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  const type = useType();
  const styles = useMemo(() => makeStyles(type), [type]);

  return (
    <View style={styles.center}>
      <Cody expression="sad" size={120} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        {onRetry && <Button label="Try again" variant="success" onPress={onRetry} />}
        {onBack && <Button label={backLabel} variant="outline" onPress={onBack} />}
      </View>
    </View>
  );
}

function makeStyles(type: ReturnType<typeof useType>) {
  return StyleSheet.create({
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: space[6], gap: space[3] },
    title: { ...type.lg, fontFamily: font.bold, color: colors.ink, textAlign: "center" },
    message: { ...type.base, fontFamily: font.regular, color: colors.ink500, textAlign: "center", maxWidth: 320 },
    actions: { marginTop: space[4], width: 260, gap: space[2] },
  });
}
