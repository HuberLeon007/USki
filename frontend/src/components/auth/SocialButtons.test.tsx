import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { SocialButtons } from "./SocialButtons";
import type { Provider } from "@/lib/social/types";

/**
 * Unit tests for the SocialButtons module (social-login 8.2).
 *
 * Covers button presence, the fixed Google/GitHub/Discord order, the English
 * "Continue with X" labels, the "or continue with" grouping divider, per-button
 * loading via aria-busy, and English error rendering through role="alert".
 */
describe("SocialButtons", () => {
  function getGroup() {
    return screen.getByRole("group", { name: "Social sign-in options" });
  }

  it("renders three provider buttons in the fixed order Google, GitHub, Discord", () => {
    render(<SocialButtons onSelect={() => {}} />);
    const buttons = within(getGroup()).getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveTextContent("Continue with Google");
    expect(buttons[1]).toHaveTextContent("Continue with GitHub");
    expect(buttons[2]).toHaveTextContent("Continue with Discord");
  });

  it("tags each button with its provider identifier", () => {
    render(<SocialButtons onSelect={() => {}} />);
    const buttons = within(getGroup()).getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("data-provider", "google");
    expect(buttons[1]).toHaveAttribute("data-provider", "github");
    expect(buttons[2]).toHaveAttribute("data-provider", "discord");
  });

  it("groups the buttons under an 'or continue with' divider", () => {
    render(<SocialButtons onSelect={() => {}} />);
    expect(screen.getByText("or continue with")).toBeInTheDocument();
  });

  it("calls onSelect with the chosen provider", () => {
    const onSelect = vi.fn<(provider: Provider) => void>();
    render(<SocialButtons onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /Continue with GitHub/ }));
    expect(onSelect).toHaveBeenCalledWith("github");
  });

  it("marks only the loading provider's button as aria-busy", () => {
    render(<SocialButtons onSelect={() => {}} loadingProvider="github" />);
    const buttons = within(getGroup()).getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-busy", "false");
    expect(buttons[1]).toHaveAttribute("aria-busy", "true");
    expect(buttons[2]).toHaveAttribute("aria-busy", "false");
  });

  it("disables all buttons while a provider is loading", () => {
    render(<SocialButtons onSelect={() => {}} loadingProvider="google" />);
    for (const button of within(getGroup()).getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
  });

  it("renders an error string through role=alert", () => {
    render(<SocialButtons onSelect={() => {}} error="Sign-in didn't complete. Please try again." />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Sign-in didn't complete. Please try again.");
  });

  it("renders no alert when there is no error", () => {
    render(<SocialButtons onSelect={() => {}} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
