import { AuthForm } from "@/components/auth/AuthForm";
import { registerAction } from "@/lib/auth-actions";

export const metadata = { title: "Enroll" };

export default function RegisterPage() {
  return <AuthForm mode="register" action={registerAction} />;
}
