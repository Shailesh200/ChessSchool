import { test, expect } from "@playwright/test";

/** M-059 — core flows at design mockup phone width (390×844). */
test.describe("mobile layout @390", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("campus uses bottom nav and single-column layout", async ({ page }) => {
    await page.goto("/academy");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Piece Movement" })).toBeVisible();
  });

  test("journey starts the active lesson from the header CTA", async ({ page }) => {
    await page.goto("/class/class-pieces");
    await expect(page.getByRole("heading", { name: "Piece Movement" })).toBeVisible();
    const start = page.getByRole("button", { name: /Start journey|Continue journey/i });
    await expect(start).toBeVisible();
    await start.click();
    await expect(page).toHaveURL(/\/lesson\//, { timeout: 15000 });
  });

  test("settings stacks sections without sidebar nav", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByRole("navigation", { name: "Settings sections" }),
    ).toBeHidden();
    await expect(page.getByText("Sound effects")).toBeVisible();
  });

  test("play pins Start game above the bottom nav", async ({ page }) => {
    await page.goto("/play");
    const start = page.getByRole("button", { name: "Start game" });
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(start).toBeVisible();
    await expect(nav).toBeVisible();
    await expect(start).toBeInViewport();

    const place = async () => {
      const startBox = await start.boundingBox();
      const navBox = await nav.boundingBox();
      expect(startBox).toBeTruthy();
      expect(navBox).toBeTruthy();
      expect(startBox!.y).toBeGreaterThanOrEqual(0);
      expect(startBox!.y + startBox!.height).toBeLessThanOrEqual(844);
      // Pinned just above the tab bar — not covered by it.
      expect(startBox!.y + startBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
      return startBox!;
    };

    await place();

    const covered = await page.evaluate(() => {
      const cta = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Start game",
      );
      if (!cta) return ["missing Start game"];
      const visibleBox = (el: Element) => {
        const r = el.getBoundingClientRect();
        let top = r.top;
        let bottom = r.bottom;
        let left = r.left;
        let right = r.right;
        let node = el.parentElement;
        while (node) {
          const style = getComputedStyle(node);
          if (/(auto|scroll|hidden)/.test(style.overflowY + style.overflowX)) {
            const clip = node.getBoundingClientRect();
            top = Math.max(top, clip.top);
            bottom = Math.min(bottom, clip.bottom);
            left = Math.max(left, clip.left);
            right = Math.min(right, clip.right);
          }
          node = node.parentElement;
        }
        return { top, bottom, left, right };
      };
      const hits = (
        a: { top: number; bottom: number; left: number; right: number },
        b: DOMRect,
      ) =>
        a.bottom > b.top + 1 &&
        a.top < b.bottom - 1 &&
        a.right > b.left + 1 &&
        a.left < b.right - 1;
      const ctaBox = cta.getBoundingClientRect();
      return [...document.querySelectorAll("button, a, input, select, textarea")]
        .filter((el) => el !== cta)
        .filter((el) => {
          const box = visibleBox(el);
          return (
            box.bottom - box.top > 1 && box.right - box.left > 1 && hits(box, ctaBox)
          );
        })
        .map((el) =>
          (el.textContent || el.getAttribute("aria-label") || el.tagName).trim(),
        );
    });
    expect(covered, "sticky CTA covers focusable controls").toEqual([]);

    await page.evaluate(() => {
      document.querySelectorAll("*").forEach((el) => {
        if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 2) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });

    const startBox = await place();
    const time = page.getByText("Time control", { exact: true });
    await expect(time).toBeInViewport();
    const cardBottom = await time.evaluate((el) => {
      let node: HTMLElement | null = el.parentElement;
      while (node && !node.className.includes("rounded-card"))
        node = node.parentElement;
      return (node ?? el).getBoundingClientRect().bottom;
    });
    expect(cardBottom).toBeLessThanOrEqual(startBox.y + 1);

    await start.evaluate((el) => {
      el.focus({ focusVisible: true } as FocusOptions);
    });
    await expect(start).toBeFocused();
    const ring = await start.evaluate((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        outline: style.outlineStyle,
        offset: Number.parseFloat(style.outlineOffset),
        // Ring must sit in the gap above the tab bar, not under it.
        bottom: rect.bottom,
      };
    });
    expect(ring.outline).not.toBe("none");
    const navBox = await nav.boundingBox();
    expect(ring.bottom + ring.offset + 3).toBeLessThanOrEqual((navBox?.y ?? 844) + 1);
  });

  test("pass-and-play Start (one device) stays above the bottom nav", async ({
    page,
  }) => {
    await page.goto("/play");
    await page.getByRole("button", { name: /vs Human/ }).click();
    const start = page.getByRole("button", { name: "Start (one device)", exact: true });
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(start).toBeVisible();
    await expect(start).toBeInViewport();

    const place = async () => {
      const startBox = await start.boundingBox();
      const navBox = await nav.boundingBox();
      expect(startBox).toBeTruthy();
      expect(navBox).toBeTruthy();
      expect(startBox!.y + startBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
      return startBox!;
    };

    const before = await place();
    await page.evaluate(() => {
      document.querySelectorAll("*").forEach((el) => {
        if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight + 2) {
          el.scrollTop = el.scrollHeight;
        }
      });
    });
    const after = await place();
    expect(Math.abs(after.y - before.y)).toBeLessThan(2);

    const cardBottom = await page
      .getByText("Time control", { exact: true })
      .evaluate((el) => {
        let node: HTMLElement | null = el.parentElement;
        while (node && !node.className.includes("rounded-card"))
          node = node.parentElement;
        return (node ?? el).getBoundingClientRect().bottom;
      });
    expect(cardBottom).toBeLessThanOrEqual(after.y + 1);
  });

  test("no horizontal overflow on primary routes", async ({ page }) => {
    const routes = [
      "/",
      "/academy",
      "/class/class-pieces",
      "/play",
      "/dashboard",
      "/plan",
      "/journal",
      "/library",
      "/settings",
    ];
    for (const route of routes) {
      await page.goto(route);
      const overflow = await page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflow, `${route} should not scroll horizontally`).toBeLessThanOrEqual(
        1,
      );
    }
  });
});
