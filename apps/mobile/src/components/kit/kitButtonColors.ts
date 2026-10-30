export type KitButtonVariant = "primary" | "accent" | "outline" | "ghost" | "danger" | "soft";

export type KitButtonPalette = Record<string, string>;

/** Fill, edge, and label colors for `.btn` variants in the premium kit. */
export function kitButtonColors(
  variant: KitButtonVariant,
  colors: KitButtonPalette,
  inactive: boolean,
): { bg: string; fg: string; edge: string; outline: boolean; ghost: boolean } {
  const outline = variant === "outline";
  const ghost = variant === "ghost";
  const bg = inactive
    ? colors.surfaceSunken!
    : ghost
      ? "transparent"
      : outline
        ? colors.surfaceCard!
        : variant === "danger"
          ? colors.danger!
          : variant === "accent"
            ? colors.accent!
            : variant === "soft"
              ? colors.brandSoft!
              : colors.brand!;
  const edge = ghost
    ? "transparent"
    : outline
      ? colors.hairline!
      : variant === "danger"
        ? colors.danger!
        : variant === "accent"
          ? colors.accent600!
          : colors.brand700!;
  const fg = inactive
    ? colors.ink300!
    : ghost
      ? colors.ink700!
      : outline
        ? colors.ink!
        : variant === "soft"
          ? colors.brandSoftText!
          : variant === "accent"
            ? colors.textOnAccent!
            : variant === "danger"
              ? "#fff"
              : colors.textOnBrand!;
  return { bg, fg, edge, outline, ghost };
}
