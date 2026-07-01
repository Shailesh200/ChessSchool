import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme";

export default function ClassExamRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    router.replace({ pathname: "/lesson/[id]", params: { id: `exam-${id}` } });
  }, [id, router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    </SafeAreaView>
  );
}
