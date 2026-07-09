"use client";

import { AppShell } from "@/components/layout/AppShell";
import { BackButton } from "@/components/ui/BackButton";
import {
  MyCompletedLibrary,
  type LibLesson,
} from "@/components/library/MyCompletedLibrary";

export function LibraryStudentView({ lessons }: { lessons: LibLesson[] }) {
  return (
    <AppShell>
      <div className="flex flex-col gap-5 lg:gap-6">
        <BackButton />
        <MyCompletedLibrary lessons={lessons} />
      </div>
    </AppShell>
  );
}
