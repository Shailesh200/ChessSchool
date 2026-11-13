import { AppShell } from "@/components/AppShell";
import { BadgeToast } from "@/components/BadgeToast";
import { ReminderClock } from "@/components/ReminderClock";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      {children}
      <ReminderClock />
      <BadgeToast />
    </AppShell>
  );
}
