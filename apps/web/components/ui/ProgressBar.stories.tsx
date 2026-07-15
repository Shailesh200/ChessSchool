import type { Meta, StoryObj } from "@storybook/react";
import { ProgressBar } from "./ProgressBar";

const meta = {
  title: "UI/ProgressBar",
  component: ProgressBar,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 0.45, label: "XP progress" },
};

export const Complete: Story = {
  args: { value: 1, tone: "success", label: "Complete" },
};

export const Empty: Story = {
  args: { value: 0, label: "Empty" },
};
