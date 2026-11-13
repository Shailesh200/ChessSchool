import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Log in" };

function emailParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? (value[0] ?? "") : "";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const params = await searchParams;
  return <AuthForm mode="login" initialEmail={emailParam(params.email)} />;
}
