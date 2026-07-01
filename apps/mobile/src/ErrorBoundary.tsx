import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { Cody } from "./Cody";
import { colors, font, space, type } from "./theme";

type Props = { children: React.ReactNode; onReset?: () => void };

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (__DEV__) console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Cody expression="sad" size={120} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message || "An unexpected error occurred."}</Text>
          <View style={styles.actions}>
            <Button
              label="Try again"
              variant="success"
              onPress={() => {
                this.setState({ error: null });
                this.props.onReset?.();
              }}
            />
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: space[6], backgroundColor: colors.surface, gap: space[3] },
  title: { ...type.lg, fontFamily: font.bold, color: colors.ink },
  message: { ...type.base, fontFamily: font.regular, color: colors.ink500, textAlign: "center", maxWidth: 320 },
  actions: { marginTop: space[4], width: 260 },
});
