import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ErrorFallback } from "../ErrorFallback";

describe("ErrorFallback", () => {
  it("renders default error message", () => {
    render(<ErrorFallback />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText("The replay dashboard hit an unexpected error. This is usually recoverable.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to race selector/i })).toHaveAttribute("href", "/");
  });

  it("renders custom message and triggers onRetry when clicked", () => {
    const onRetry = vi.fn();
    render(<ErrorFallback message="Network timeout fetching replay frames" onRetry={onRetry} />);

    expect(screen.getByText("Network timeout fetching replay frames")).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: /Try again/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
