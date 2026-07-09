import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { loginAction } from "@/lib/auth-actions";
import { getCurrentUser } from "@/lib/auth";
import { socialMeta } from "@/lib/seo";

export const metadata = {
  title: "Log in to ChessSchool",
  description:
    "Sign in to sync your chess progress, classes, and game history at ChessSchool.",
  ...socialMeta({
    title: "Log in to ChessSchool",
    description: "Continue your chess journey — sync progress across devices.",
    path: "/login",
    kind: "home",
    badge: "Chess School",
    emoji: "🔐",
  }),
};
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already logged in (e.g. tapped Back onto /login) → bounce to the Learn tab.
  if (await getCurrentUser()) redirect("/");
  return <AuthForm mode="login" action={loginAction} />;
}
