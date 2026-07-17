import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Toggle } from "./Toggle";

const meta = {
  title: "UI/Toggle",
  component: Toggle,
  tags: ["autodocs"],
  args: {
    checked: false,
    onChange: () => undefined,
    label: "Sound effects",
  },
} satisfies Meta<typeof Toggle>;

export default meta;
type Story = StoryObj<typeof meta>;

function ToggleDemo({ initial = false }: { initial?: boolean }) {
  const [checked, setChecked] = useState(initial);
  return (
    <div className="flex items-center gap-3">
      <Toggle checked={checked} onChange={setChecked} label="Sound effects" />
      <span className="text-ink-700 text-sm font-semibold">
        Sound effects {checked ? "on" : "off"}
      </span>
    </div>
  );
}

export const Off: Story = {
  render: () => <ToggleDemo initial={false} />,
};

export const On: Story = {
  render: () => <ToggleDemo initial={true} />,
};
