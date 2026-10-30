import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import { Sheet } from "./Sheet";

afterEach(() => {
  vi.restoreAllMocks();
});

function SheetHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Settings">
        <button type="button">Inside action</button>
      </Sheet>
    </>
  );
}

function ConfirmHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open confirm
      </button>
      <ConfirmDialog
        open={open}
        title="Delete item?"
        message="This cannot be undone."
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

describe("useModalFocus (Sheet + ConfirmDialog)", () => {
  it("focuses the first control, wraps Tab at the end, and restores focus on close", async () => {
    render(<SheetHarness />);

    const trigger = screen.getByRole("button", { name: "Open sheet" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "Settings" })).toHaveAttribute(
      "aria-modal",
      "true",
    );

    const closeBackdrop = screen.getByRole("button", { name: "Close" });
    const inside = screen.getByRole("button", { name: "Inside action" });
    expect(closeBackdrop).toHaveFocus();

    inside.focus();
    fireEvent.keyDown(window, { key: "Tab", code: "Tab" });
    expect(closeBackdrop).toHaveFocus();

    closeBackdrop.focus();
    fireEvent.keyDown(window, { key: "Tab", code: "Tab", shiftKey: true });
    expect(inside).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Settings" }),
      ).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("wraps Tab inside ConfirmDialog and restores focus when dismissed", async () => {
    render(<ConfirmHarness />);

    const trigger = screen.getByRole("button", { name: "Open confirm" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("alertdialog", { name: "Delete item?" })).toHaveAttribute(
      "aria-modal",
      "true",
    );

    const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
    const cancelBackdrop = cancelButtons[0]!;
    const cancelBtn = cancelButtons[1]!;
    const confirmBtn = screen.getByRole("button", { name: "Confirm" });

    expect(cancelBackdrop).toHaveFocus();

    confirmBtn.focus();
    fireEvent.keyDown(window, { key: "Tab", code: "Tab" });
    expect(cancelBackdrop).toHaveFocus();

    cancelBackdrop.focus();
    fireEvent.keyDown(window, { key: "Tab", code: "Tab", shiftKey: true });
    expect(confirmBtn).toHaveFocus();

    fireEvent.click(cancelBtn);
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });
});
