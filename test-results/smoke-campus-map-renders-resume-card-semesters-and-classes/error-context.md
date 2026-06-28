# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> campus map renders resume card, semesters and classes
- Location: e2e/smoke.spec.ts:3:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Semester 1 · Foundations')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Semester 1 · Foundations')

```

```yaml
- banner: 0 L1 0
- main:
  - heading "Welcome to ChessSchool!" [level=1]
  - paragraph: Graduate through classes. Become a stronger player.
  - paragraph: 🎯 New here? Take a quick placement test
  - paragraph: 8 puzzles (~2 min) — we'll place you in Elementary, Middle, or High School.
  - button "Start placement test →"
  - navigation "Your place in school": 🎓 Foundations Piece Movement Class 1/83
  - heading "The Battlefield" [level=2]
  - paragraph: Next in Piece Movement
  - progressbar "Class progress"
  - button "Start learning"
  - text: Daily goal 0/50 XP
  - progressbar "Daily goal progress"
  - text: 🎒
  - heading "Elementary School" [level=2]
  - paragraph: Classes 1–5 · the essentials
  - text: Foundations How the pieces move and how games end ♟️
  - heading "Piece Movement" [level=2]
  - paragraph: Pawns, rooks & knights
  - text: 0/4
  - progressbar "Piece Movement progress"
  - button "Start class"
  - button "📝 Test out"
  - text: 🔒
  - heading "Checks & Checkmates" [level=2]
  - paragraph: Attack the king and finish
  - text: 0/2
  - progressbar "Checks & Checkmates progress"
  - button "🎓 Test to unlock"
  - text: Pawn Promotion Queen your pawns to win 🔒
  - heading "First Promotions" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "First Promotions progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Queening Pawns" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Queening Pawns progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Promotion Races" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Promotion Races progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Underpromotion Tricks" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Underpromotion Tricks progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "First Promotions 2" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "First Promotions 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Queening Pawns 2" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Queening Pawns 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Promotion Races 2" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Promotion Races 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Underpromotion Tricks 2" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Underpromotion Tricks 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "First Promotions 3" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "First Promotions 3 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Queening Pawns 3" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Queening Pawns 3 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Promotion Races 3" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Promotion Races 3 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Underpromotion Tricks 3" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Underpromotion Tricks 3 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "First Promotions 4" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "First Promotions 4 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Queening Pawns 4" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Queening Pawns 4 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Promotion Races 4" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Promotion Races 4 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Underpromotion Tricks 4" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Underpromotion Tricks 4 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "First Promotions 5" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "First Promotions 5 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Queening Pawns 5" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Queening Pawns 5 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Promotion Races 5" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Promotion Races 5 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Underpromotion Tricks 5" [level=2]
  - paragraph: 6 lessons
  - text: 0/6
  - progressbar "Underpromotion Tricks 5 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "First Promotions 6" [level=2]
  - paragraph: 5 lessons
  - text: 0/5
  - progressbar "First Promotions 6 progress"
  - button "🎓 Test to unlock"
  - text: 📐
  - heading "Middle School" [level=2]
  - paragraph: Classes 6–8 · tactics & endgames
  - text: Opening School Start every game like a pro 🔒
  - heading "Opening Principles" [level=2]
  - paragraph: Centre, develop, castle
  - text: 0/1
  - progressbar "Opening Principles progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Famous Openings" [level=2]
  - paragraph: Italian, Ruy Lopez & Sicilian
  - text: 0/3
  - progressbar "Famous Openings progress"
  - button "🎓 Test to unlock"
  - text: Tactics Lab Win material with combinations 🔒
  - heading "Tactical Motifs" [level=2]
  - paragraph: Forks & combinations
  - text: 0/1
  - progressbar "Tactical Motifs progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Advanced Tactics" [level=2]
  - paragraph: Pins, skewers & discoveries
  - text: 0/3
  - progressbar "Advanced Tactics progress"
  - button "🎓 Test to unlock"
  - text: Endgame School Convert advantages into wins 🔒
  - heading "Essential Endgames" [level=2]
  - paragraph: Opposition, promotion & mates
  - text: 0/3
  - progressbar "Essential Endgames progress"
  - button "🎓 Test to unlock"
  - text: Winning Material Spot and grab undefended pieces 🔒
  - heading "Hanging Pieces" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Hanging Pieces progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Loose Pieces" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Loose Pieces progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Undefended Targets" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Undefended Targets progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Greedy Captures" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Greedy Captures progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Material Edge" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Material Edge progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Hanging Pieces 2" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Hanging Pieces 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Loose Pieces 2" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Loose Pieces 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Undefended Targets 2" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Undefended Targets 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Greedy Captures 2" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Greedy Captures 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Material Edge 2" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Material Edge 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Hanging Pieces 3" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Hanging Pieces 3 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Loose Pieces 3" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Loose Pieces 3 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Undefended Targets 3" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Undefended Targets 3 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Greedy Captures 3" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Greedy Captures 3 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Material Edge 3" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Material Edge 3 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Hanging Pieces 4" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Hanging Pieces 4 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Loose Pieces 4" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Loose Pieces 4 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Undefended Targets 4" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Undefended Targets 4 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Greedy Captures 4" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Greedy Captures 4 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Material Edge 4" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Material Edge 4 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Hanging Pieces 5" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Hanging Pieces 5 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Loose Pieces 5" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Loose Pieces 5 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Undefended Targets 5" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Undefended Targets 5 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Greedy Captures 5" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Greedy Captures 5 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Material Edge 5" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Material Edge 5 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Hanging Pieces 6" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Hanging Pieces 6 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Loose Pieces 6" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Loose Pieces 6 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Undefended Targets 6" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Undefended Targets 6 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Greedy Captures 6" [level=2]
  - paragraph: 8 lessons
  - text: 0/8
  - progressbar "Greedy Captures 6 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Material Edge 6" [level=2]
  - paragraph: 2 lessons
  - text: 0/2
  - progressbar "Material Edge 6 progress"
  - button "🎓 Test to unlock"
  - text: Checks & Threats Find the forcing checks 🔒
  - heading "Forcing Checks" [level=2]
  - paragraph: 10 lessons
  - text: 0/10
  - progressbar "Forcing Checks progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Check Hunts" [level=2]
  - paragraph: 10 lessons
  - text: 0/10
  - progressbar "Check Hunts progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Royal Pressure" [level=2]
  - paragraph: 10 lessons
  - text: 0/10
  - progressbar "Royal Pressure progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Checking Patterns" [level=2]
  - paragraph: 10 lessons
  - text: 0/10
  - progressbar "Checking Patterns progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Forcing Checks 2" [level=2]
  - paragraph: 10 lessons
  - text: 0/10
  - progressbar "Forcing Checks 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Check Hunts 2" [level=2]
  - paragraph: 10 lessons
  - text: 0/10
  - progressbar "Check Hunts 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Royal Pressure 2" [level=2]
  - paragraph: 10 lessons
  - text: 0/10
  - progressbar "Royal Pressure 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Checking Patterns 2" [level=2]
  - paragraph: 10 lessons
  - text: 0/10
  - progressbar "Checking Patterns 2 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Forcing Checks 3" [level=2]
  - paragraph: 10 lessons
  - text: 0/10
  - progressbar "Forcing Checks 3 progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Check Hunts 3" [level=2]
  - paragraph: 10 lessons
  - text: 0/10
  - progressbar "Check Hunts 3 progress"
  - button "🎓 Test to unlock"
  - text: 🎓
  - heading "High School" [level=2]
  - paragraph: Classes 9–12 · openings & checkmates
  - text: Checkmate Patterns Deliver mate in one 🔒
  - heading "Back-Rank Mates" [level=2]
  - paragraph: 12 lessons
  - text: 0/12
  - progressbar "Back-Rank Mates progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Mate in One" [level=2]
  - paragraph: 12 lessons
  - text: 0/12
  - progressbar "Mate in One progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Finishing Blows" [level=2]
  - paragraph: 12 lessons
  - text: 0/12
  - progressbar "Finishing Blows progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Delivering Mate" [level=2]
  - paragraph: 12 lessons
  - text: 0/12
  - progressbar "Delivering Mate progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Back-Rank Mates 2" [level=2]
  - paragraph: 2 lessons
  - text: 0/2
  - progressbar "Back-Rank Mates 2 progress"
  - button "🎓 Test to unlock"
  - text: Opening Theory The famous openings 🔒
  - heading "Italian Game" [level=2]
  - paragraph: 1.e4 e5 2.Nf3 Nc6 3.Bc4
  - text: 0/1
  - progressbar "Italian Game progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Ruy Lopez" [level=2]
  - paragraph: 1.e4 e5 2.Nf3 Nc6 3.Bb5
  - text: 0/1
  - progressbar "Ruy Lopez progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Sicilian Defense" [level=2]
  - paragraph: The Open Sicilian
  - text: 0/1
  - progressbar "Sicilian Defense progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "French Defense" [level=2]
  - paragraph: 1.e4 e6 2.d4 d5
  - text: 0/1
  - progressbar "French Defense progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Caro-Kann" [level=2]
  - paragraph: 1.e4 c6 2.d4 d5
  - text: 0/1
  - progressbar "Caro-Kann progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Scandinavian" [level=2]
  - paragraph: 1.e4 d5
  - text: 0/1
  - progressbar "Scandinavian progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "Queen's Gambit" [level=2]
  - paragraph: 1.d4 d5 2.c4
  - text: 0/1
  - progressbar "Queen's Gambit progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "King's Indian" [level=2]
  - paragraph: 1.d4 Nf6 2.c4 g6
  - text: 0/1
  - progressbar "King's Indian progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "London System" [level=2]
  - paragraph: 1.d4 d5 2.Nf3 Nf6 3.Bf4
  - text: 0/1
  - progressbar "London System progress"
  - button "🎓 Test to unlock"
  - text: 🔒
  - heading "English Opening" [level=2]
  - paragraph: 1.c4 e5 2.Nc3
  - text: 0/1
  - progressbar "English Opening progress"
  - button "🎓 Test to unlock"
  - text: 🏛️
  - heading "University" [level=2]
  - paragraph: Classes 13–16 · deep theory
  - paragraph: 🔒 Unlocks after you graduate the earlier stages — more classes coming.
  - text: ♛
  - heading "Master Program" [level=2]
  - paragraph: Classes 17–20 · the road to mastery
  - paragraph: 🔒 Unlocks after you graduate the earlier stages — more classes coming.
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
> 7  |   await expect(page.getByText("Semester 1 · Foundations")).toBeVisible();
     |                                                            ^ Error: expect(locator).toBeVisible() failed
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
  37 |   await expect(page.getByRole("button", { name: /Export backup/ })).toBeVisible();
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