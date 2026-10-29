import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SettingsCoachField } from "./CoachCharacterPicker";

describe("SettingsCoachField", () => {
  it("renders the coach line before any portrait or TTS request", () => {
    const html = renderToString(
      <SettingsCoachField value="anxious_nerd" onChange={() => {}} />,
    );

    expect(html).toContain(
      "One coach for lessons and matches — tap to preview their voice.",
    );
    expect(html).not.toContain("/coaches/");
    expect(html).not.toContain("/api/tts");
    expect(html).not.toContain("<img");
  });
});
