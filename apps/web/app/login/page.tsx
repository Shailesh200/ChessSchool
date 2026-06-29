import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { loginAction } from "@/lib/auth-actions";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already logged in (e.g. tapped Back onto /login) → bounce to the Learn tab.
  if (await getCurrentUser()) redirect("/");
  return <AuthForm mode="login" action={loginAction} />;
}
