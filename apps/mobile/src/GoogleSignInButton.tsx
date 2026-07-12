import { useEffect } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { useAppTheme } from "@/ThemeProvider";
import { GoogleMark } from "@/GoogleMark";
import { font, radius, shadowCard, space, type } from "@/theme";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? "";

type Props = {
  disabled?: boolean;
  onIdToken: (idToken: string) => Promise<void>;
  onError: (message: string) => void;
};

function nativeClientId(): string | null {
  if (Platform.OS === "ios") return IOS_CLIENT_ID || null;
  if (Platform.OS === "android") return ANDROID_CLIENT_ID || null;
  return WEB_CLIENT_ID || null;
}

function isGoogleConfigured(): boolean {
  if (Platform.OS === "web") return Boolean(WEB_CLIENT_ID);
  return Boolean(WEB_CLIENT_ID && nativeClientId());
}

function configHint(): string {
  if (Platform.OS === "android") {
    return "Add an Android OAuth client (package com.chessschool.app) as EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID.";
  }
  if (Platform.OS === "ios") {
    return "Add an iOS OAuth client as EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.";
  }
  return "Google sign-in is not configured.";
}

function GoogleSignInButtonInner({ disabled, onIdToken, onError }: Props) {
  const { colors } = useAppTheme();

  useEffect(() => {
    void WebBrowser.maybeCompleteAuthSession();
  }, []);

  const clientId = nativeClientId();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      webClientId: WEB_CLIENT_ID,
      ...(Platform.OS === "ios" && IOS_CLIENT_ID ? { iosClientId: IOS_CLIENT_ID } : {}),
      ...(Platform.OS === "android" && ANDROID_CLIENT_ID ? { androidClientId: ANDROID_CLIENT_ID } : {}),
      selectAccount: true,
    },
    { scheme: "chessschool" },
  );

  useEffect(() => {
    if (!response) return;
    if (response.type === "error") {
      const detail =
        response.params?.error_description ??
        response.params?.error ??
        response.error?.message;
      onError(
        typeof detail === "string" && detail.includes("access_denied")
          ? "Google sign-in was cancelled."
          : typeof detail === "string"
            ? detail
            : "Google sign-in failed. Check OAuth client IDs for this platform.",
      );
      return;
    }
    if (response.type !== "success") return;
    const idToken = response.params.id_token;
    if (!idToken) {
      onError("Google did not return a sign-in token.");
      return;
    }
    void onIdToken(idToken).catch((e: unknown) => {
      onError(e instanceof Error ? e.message : "Google sign-in failed.");
    });
  }, [response, onIdToken, onError]);

  const styles = StyleSheet.create({
    button: {
      height: 52,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: colors.hairline,
      backgroundColor: colors.surfaceCard,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: space[3],
      ...shadowCard,
    },
    text: { ...type.base, fontFamily: font.bold, color: colors.ink },
    disabled: { opacity: 0.55 },
  });

  if (!clientId) {
    return (
      <View style={[styles.button, styles.disabled]}>
        <Text style={[styles.text, { fontSize: 13, textAlign: "center", paddingHorizontal: space[2] }]}>
          Google sign-in needs a native OAuth client — see RELEASE.md
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.button, (disabled || !request) && styles.disabled]}
      disabled={disabled || !request}
      onPress={() => {
        void promptAsync();
      }}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
    >
      {!request ? (
        <ActivityIndicator color={colors.brand} />
      ) : (
        <>
          <GoogleMark size={20} />
          <Text style={styles.text}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

/** Native Google Sign-In — returns an ID token for `/api/auth/google/token`. */
export function GoogleSignInButton(props: Props) {
  if (!WEB_CLIENT_ID) return null;
  return <GoogleSignInButtonInner {...props} />;
}

export function googleSignInConfigHint(): string | null {
  if (isGoogleConfigured()) return null;
  return configHint();
}
