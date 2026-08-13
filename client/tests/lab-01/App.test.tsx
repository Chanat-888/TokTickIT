import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App", () => {
  // Without this, a mock set in one test leaks into the next.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // WORKED EXAMPLE — provided for you.
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows Online and the seeded categories on success", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
        { id: 3, name: "Software" },
        { id: 4, name: "Network" },
      ],
    });

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText("System Status: Online")).toBeInTheDocument();

    // Assert order, not just presence — the list must mirror the API's order.
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "Account and Access",
      "Hardware",
      "Software",
      "Network",
    ]);
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(new Error("network failure"));

    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /check system/i }));

    expect(await screen.findByText("System Status: Offline")).toBeInTheDocument();
    expect(
      screen.getByText("Unable to connect to TokTickIT API"),
    ).toBeInTheDocument();

    // No stale list left behind from a previous successful check.
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
