import { AuthForm } from "@/components/auth/AuthForm";
import { registerAction } from "@/lib/auth-actions";
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

export default function RegisterPage() {
  return <AuthForm mode="register" action={registerAction} />;
}
