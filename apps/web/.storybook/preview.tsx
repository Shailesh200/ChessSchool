import type { Preview } from "@storybook/react";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
    backgrounds: {
      default: "surface",
      values: [
        { name: "surface", value: "#f7f4ee" },
        { name: "white", value: "#ffffff" },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-surface text-ink min-h-[120px] p-6 font-sans antialiased">
        <Story />
      </div>
    ),
  ],
};

export default preview;
