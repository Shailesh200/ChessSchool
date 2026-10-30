import type { CoachAvatarState } from "@/coachCharacters";
import { coachCharacterIdFromPremiumSlug } from "@/coachCharacters";
import type { CoachMood, CoachSlug } from "./coachArt";

export function slugToCharacterId(slug: CoachSlug): ReturnType<typeof coachCharacterIdFromPremiumSlug> {
  return coachCharacterIdFromPremiumSlug(slug);
}

export function coachMoodToAvatarState(mood?: CoachMood): CoachAvatarState {
  switch (mood) {
    case "thinking":
      return "think";
    case "happy":
    case "celebrating":
      return "success";
    case "sad":
      return "miss";
    case "encouraging":
      return "speak";
    default:
      return "idle";
  }
}
