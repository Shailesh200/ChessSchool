# Mobile Premium Illustrated kit (`apps/mobile/src/components/kit`)

Dex Nov 2 **Premium Illustrated** theme for Expo / React Native. Token source: `src/theme/premium/tokens.json` (sync from `design/premium/kit/tokens/tokens.json` when it lands).

## Theme switch

- Setting key: `settings.uiKit` — `"premium"` (default) or `"classic"`.
- `ThemeProvider` merges premium color tokens when `uiKit === "premium"`.
- Dark premium follows system dark mode or Midnight app theme.

Toggle in **Settings → Appearance → Premium illustrated UI**.

## Tokens

| CSS / JSON | RN `usePremiumKitTheme()` |
| --- | --- |
| `--brand-500` | `colors.brand` |
| `--surface-card` | `colors.surfaceCard` |
| `--chip-streak-bg` | `colors.chipStreakBg` |
| `--chip-xp-bg` | `colors.chipXpBg` |
| `--radius-lg` | `radius.lg` |
| `--space-4` | `space["4"]` |
| `.btn` shadow | `shadowStyle("elev-2")` |

Fonts load via existing `@expo-google-fonts/fredoka` in `app/_layout.tsx` (`Fredoka_*` families referenced in `tokens.json` → `font.displayBold`, etc.).

## Components

Import from `@/components/kit`:

### `KitButton`

Props: `label`, `onPress`, `variant?` (`primary` \| `accent` \| `outline` \| `ghost` \| `danger`), `size?`, `block?`, `disabled?`, `loading?`, `testID?`.

```tsx
<KitButton label="Continue" onPress={() => {}} variant="primary" />
```

### `KitCard`

Props: `children`, `variant?` (`card` \| `paper` \| `sunken`), `style?`, `testID?`.

### `KitTabBar` / `KitBottomNav`

Learn · Play · Review · Profile (Gym lives under Learn). Wired in `(tabs)/_layout` and `AppShell` when premium.

### `KitSheet`

Props: `open`, `onClose`, `title?`, `children`.

### `KitTopBar`

Streak chip (flame) + XP chip only — no hearts/lives. Used via `TopBar` when premium.

### `KitIcon`

Props: `name` (`KitIconName`), `size?`, `color?`, `strokeWidth?`. Lucide-derived stroke set from the kit.

### `KitLogo`

Props: `withText?`, `size?`, `style?`.

### `KitCoachAvatar`

Props: `character`, `state?`, `size?`, `style?`. Radial accent plate (`coachGlow` → tint → deep tint). Reduced motion → static coach PNG.

## Hooks

- `useUiKit()` → `"premium"` \| `"classic"`
- `usePremiumKitTheme()` → full token object (colors, space, radius, type, font, shadow)

## Screens (premium)

| Route | Kit screen module |
| --- | --- |
| Profile tab | `src/screens/premium/ProfileScreen.tsx` |
| `/settings` | `src/screens/premium/SettingsScreen.tsx` |
| `/notifications` | `src/screens/premium/NotificationsScreen.tsx` |
| `/notifications/saved` | `src/screens/premium/NotificationsSavedScreen.tsx` |

Legacy UI remains when `uiKit === "classic"`.
