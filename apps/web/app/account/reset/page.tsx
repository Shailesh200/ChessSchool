import { AccountResetClient } from "./AccountResetClient";

export const metadata = {
  title: "Reset password",
  description: "Choose a new password for your ChessSchool account.",
  robots: { index: false, follow: true },
};

export default async function AccountResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const trimmed = token?.trim() ?? "";

  return (
    <div className="bg-surface flex min-h-dvh flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm min-w-0">
        <h1 className="text-ink text-2xl font-extrabold break-words">Choose a new password</h1>
        <AccountResetClient token={trimmed} />
      </div>
    </div>
  );
}
