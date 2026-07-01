/** Put each answer on its own line in legacy "Q: … A: …" coach copy. */
export function formatCoachText(text: string): string {
  if (!/\bQ:\s/.test(text) && !/\bA:\s/.test(text)) return text;
  return text
    .replace(/\s+A:\s+/g, "\nA: ")
    .replace(/\s+Q:\s+/g, "\n\nQ: ")
    .trim();
}
