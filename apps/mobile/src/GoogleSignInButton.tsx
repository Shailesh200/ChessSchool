import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { useAppTheme } from "@/ThemeProvider";
import { GoogleMark } from "@/GoogleMark";
import { font, radius, shadowCard, space, type } from "@/theme";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID || undefined,
    iosClientId: IOS_CLIENT_ID || undefined,
    offlineAccess: false,
  });
  configured = true;
}

type Props = {
  disabled?: boolean;
  onIdToken: (idToken: string) => Promise<void>;
  onError: (message: string) => void;
};

function nativeClientReady(): boolean {
  if (!WEB_CLIENT_ID) return false;
  // Android: Web client ID is enough in-app; Google Cloud still needs an Android
  // OAuth client with package com.chessschool.app + your keystore SHA-1.
  if (Platform.OS === "ios") return Boolean(IOS_CLIENT_ID);
  return true;
}

function configHint(): string {
  if (Platform.OS === "android") {
    return "Set EXPO_PUBLIC_GOOGLE_CLIENT_ID (Web) and register an Android OAuth client with package com.chessschool.app + SHA-1 in Google Cloud.";
  }
  if (Platform.OS === "ios") {
    return "Add an iOS OAuth client as EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.";
  }
  return "Google sign-in is not configured.";
}

function GoogleSignInButtonInner({ disabled, onIdToken, onError }: Props) {
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState(false);

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

  if (!nativeClientReady()) {
    return (
      <View style={[styles.button, styles.disabled]}>
        <Text style={[styles.text, { fontSize: 13, textAlign: "center", paddingHorizontal: space[2] }]}>
          Google sign-in needs a native OAuth client — see RELEASE.md
        </Text>
      </View>
    );
  }

  async function signIn() {
    if (busy || disabled) return;
    setBusy(true);
    try {
      ensureConfigured();
      if (Platform.OS === "android") {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        onError("Google sign-in was cancelled.");
        return;
      }
      const idToken = response.data.idToken;
      if (!idToken) {
        onError("Google did not return a sign-in token. Confirm Web + Android OAuth clients in EAS env.");
        return;
      }
      await onIdToken(idToken);
    } catch (e: unknown) {
      if (isErrorWithCode(e)) {
        if (e.code === statusCodes.SIGN_IN_CANCELLED) {
          onError("Google sign-in was cancelled.");
          return;
        }
        if (e.code === statusCodes.IN_PROGRESS) return;
        if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          onError("Google Play Services is required for sign-in.");
          return;
        }
      }
      onError(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      style={[styles.button, (disabled || busy) && styles.disabled]}
      disabled={disabled || busy}
      onPress={() => void signIn()}
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
    >
      {busy ? (
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

/** Native Google account picker — returns an ID token for `/api/auth/google/token`. */
export function GoogleSignInButton(props: Props) {
  if (!WEB_CLIENT_ID) return null;
  return <GoogleSignInButtonInner {...props} />;
}

export function googleSignInConfigHint(): string | null {
  if (nativeClientReady()) return null;
  return configHint();
}
