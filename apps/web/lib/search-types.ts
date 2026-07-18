export type SearchResult = {
  id: string;
  type: "lesson" | "class" | "action";
  title: string;
  subtitle?: string;
  href: string;
  emoji?: string;
  tag?: string;
};
