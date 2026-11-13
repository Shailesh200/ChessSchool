import { useLocalSearchParams } from "expo-router";
import { AuthForm } from "@/components/AuthForm";

function emailParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
}

export default function Signup() {
  const params = useLocalSearchParams<{ email?: string }>();
  return <AuthForm mode="signup" initialEmail={emailParam(params.email)} topSpacing={12} />;
}
