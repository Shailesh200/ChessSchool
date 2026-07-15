import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";

const meta = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="space-y-1">
        <p className="text-ink text-sm font-extrabold">Daily goal</p>
        <p className="text-ink-500 text-xs font-semibold">
          Complete one lesson to keep your streak.
        </p>
      </div>
    ),
  },
};
