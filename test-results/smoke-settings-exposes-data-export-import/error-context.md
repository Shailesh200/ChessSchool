# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> settings exposes data export/import
- Location: e2e/smoke.spec.ts:35:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /Export backup/ })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: /Export backup/ })

```

```yaml
- banner: 0 L1 0
- main:
  - button "Back"
  - heading "Settings" [level=1]
  - paragraph: Sound & Feel
  - paragraph: Sound effects
  - switch "Sound effects" [checked]
  - paragraph: Volume
  - paragraph: 70%
  - slider "Volume": "0.7"
  - paragraph: Haptics
  - paragraph: Vibration on supported devices
  - switch "Haptics" [checked]
  - paragraph: Accessibility
  - paragraph: Reduce motion
  - paragraph: Minimize animations
  - switch "Reduce motion"
  - paragraph: High contrast
  - switch "High contrast"
  - paragraph: Colorblind board
  - paragraph: Deuteranopia-friendly palette
  - switch "Colorblind board"
  - paragraph: Learning & Board
  - paragraph: Coach hints
  - paragraph: Show arrows and tips
  - switch "Coach hints" [checked]
  - paragraph: Bot difficulty
  - paragraph: Target ELO 600
  - slider "Bot difficulty": "600"
  - paragraph: Coach personality
  - paragraph: Tone of feedback
  - combobox "Coach personality":
    - option "😊 Friendly Teacher" [selected]
    - option "🎩 Strict Grandmaster"
    - option "🧑‍🏫 Mentor"
    - option "⚔️ Tactical"
    - option "🔇 Minimal"
  - paragraph: ChessSchool v3.0 · Guest mode
- navigation:
  - list:
    - listitem:
      - link "Learn":
        - /url: /
    - listitem:
      - link "Play":
        - /url: /play
    - listitem:
      - link "Review":
        - /url: /review
    - listitem:
      - link "Profile":
        - /url: /profile
- alert
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test("campus map renders resume card, semesters and classes", async ({ page }) => {
  4  |   await page.goto("/");
  5  |   await expect(page.getByText("Daily goal")).toBeVisible();
  6  |   await expect(page.getByRole("navigation", { name: "Your place in school" })).toBeVisible();
  7  |   await expect(page.getByText("Foundations").first()).toBeVisible();
  8  |   await expect(page.getByRole("heading", { name: "Piece Movement" })).toBeVisible();
  9  | });
  10 | 
  11 | test("class journey shows the milestone path", async ({ page }) => {
  12 |   await page.goto("/class/class-pieces");
  13 |   await expect(page.getByRole("heading", { name: "Piece Movement" })).toBeVisible();
  14 |   await expect(page.getByText(/lessons/)).toBeVisible();
  15 |   await expect(page.getByText("The Battlefield")).toBeVisible();
  16 | });
  17 | 
  18 | test("theme studio shows app + board themes with live preview", async ({ page }) => {
  19 |   await page.goto("/themes");
  20 |   await expect(page.getByText("Theme Studio")).toBeVisible();
  21 |   await expect(page.getByText("Live preview")).toBeVisible();
  22 |   await expect(page.getByText("App theme")).toBeVisible();
  23 |   await expect(page.getByText("Board themes")).toBeVisible();
  24 |   // switching to Midnight applies a dark surface
  25 |   await page.getByText("🌙 Midnight").click();
  26 |   await expect(page.locator("html")).toHaveAttribute("data-app-theme", "midnight");
  27 | });
  28 | 
  29 | test("dashboard shows skill tree and mistake DNA", async ({ page }) => {
  30 |   await page.goto("/dashboard");
  31 |   await expect(page.getByText("Skill tree")).toBeVisible();
  32 |   await expect(page.getByText("Mistake DNA")).toBeVisible();
  33 | });
  34 | 
  35 | test("settings exposes data export/import", async ({ page }) => {
  36 |   await page.goto("/settings");
> 37 |   await expect(page.getByRole("button", { name: /Export backup/ })).toBeVisible();
     |                                                                     ^ Error: expect(locator).toBeVisible() failed
  38 | });
  39 | 
  40 | test("lesson loads with coach narration", async ({ page }) => {
  41 |   await page.goto("/lesson/pawn-power");
  42 |   await expect(page.getByText(/Push your e-pawn/i)).toBeVisible();
  43 | });
  44 | 
  45 | test("play: choose a mode, start a match, and the bot replies", async ({ page }) => {
  46 |   await page.goto("/play");
  47 |   await expect(page.getByText("New match")).toBeVisible();
  48 |   await page.getByRole("button", { name: "Start match" }).click();
  49 | 
  50 |   // Focus mode: top action bar shows Resign, nav is hidden.
  51 |   await expect(page.getByRole("button", { name: "Resign" })).toBeVisible();
  52 | 
  53 |   // Make e2-e4; the bot should reply (Thinking… then a coach line).
  54 |   await page.locator('[data-square="e2"]').click();
  55 |   await page.locator('[data-square="e4"]').click();
  56 |   await expect(page.getByText("Thinking…")).toBeHidden({ timeout: 5000 });
  57 | });
  58 | 
  59 | test("review tab shows match history section", async ({ page }) => {
  60 |   await page.goto("/review");
  61 |   await expect(page.getByText("Match history")).toBeVisible();
  62 | });
  63 | 
  64 | test("settings exposes accessibility controls", async ({ page }) => {
  65 |   await page.goto("/settings");
  66 |   await expect(page.getByText("Reduce motion")).toBeVisible();
  67 |   await expect(page.getByText("Coach personality")).toBeVisible();
  68 | });
  69 | 
```