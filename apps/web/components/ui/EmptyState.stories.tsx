import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    illustration: "review",
    title: "No matches yet",
    description: "Play a bot game and your history will show up here.",
    action: { label: "Go play", href: "/play" },
  },
};

export const Library: Story = {
  args: {
    illustration: "library",
    title: "Nothing completed yet",
    description: "Finish a lesson and it will appear in your library.",
    action: { label: "Open campus", href: "/academy" },
  },
};
