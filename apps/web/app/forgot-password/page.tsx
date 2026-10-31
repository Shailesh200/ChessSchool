import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata = {
  title: "Forgot password",
  description: "Request a password reset link for your ChessSchool account.",
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return (
    <div className="bg-surface flex min-h-dvh flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm min-w-0">
        <h1 className="text-ink text-2xl font-extrabold break-words">
          Forgot your password?
        </h1>
        <p className="text-ink-500 mt-3 text-sm font-semibold break-words">
          Enter the email you used to enroll. We&apos;ll send a link to choose a new
          password.
        </p>
        <div className="mt-6">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
