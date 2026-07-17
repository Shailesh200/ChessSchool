import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { registerAction } from "@/lib/auth-actions";
import { getCurrentUser } from "@/lib/auth";
import { socialMeta } from "@/lib/seo";

export const metadata = {
  title: "Enroll — Free Chess School Account",
  description:
    "Create a free ChessSchool account — save progress, take the placement test, and graduate through chess classes.",
  ...socialMeta({
    title: "Join ChessSchool — Free",
    description:
      "Enroll in the free online chess academy. Classes, puzzles, and live play.",
    path: "/register",
    kind: "home",
    badge: "Enroll Free",
    emoji: "🎓",
  }),
};

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <Suspense
      fallback={<div className="skeleton rounded-card mx-auto mt-24 h-64 max-w-sm" />}
    >
      <AuthForm mode="register" action={registerAction} />
    </Suspense>
  );
}
