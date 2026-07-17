import { api } from "./api";

export type StudentProfile = {
  studentNo: string;
  enrolledAt: number;
  rankTitle: string;
  avatarUrl: string | null;
  goal: string | null;
  house: string | null;
  onboarded: boolean;
};

export async function fetchProfile(): Promise<StudentProfile | null> {
  try {
    return await api<StudentProfile>("/api/profile");
  } catch {
    return null;
  }
}

export async function saveOnboardingToServer(goal: string, avatar: string): Promise<void> {
  await api("/api/profile/onboarding", {
    method: "POST",
    body: { goal, avatar },
  });
}
