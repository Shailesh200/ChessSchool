import { AuthForm } from "@/components/auth/AuthForm";
import { loginAction } from "@/lib/auth-actions";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return <AuthForm mode="login" action={loginAction} />;
}
