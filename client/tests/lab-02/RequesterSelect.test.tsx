import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RequesterSelect from "../../src/screens/RequesterSelect.js";
import { RequesterProvider, getSelectedRequester } from "../../src/lib/requesterContext.js";

function renderScreen() {
  return render(
    <RequesterProvider>
      <MemoryRouter initialEntries={["/select-requester"]}>
        <Routes>
          <Route path="/select-requester" element={<RequesterSelect />} />
          <Route path="/tickets" element={<h1>My Tickets</h1>} />
        </Routes>
      </MemoryRouter>
    </RequesterProvider>,
  );
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe("RequesterSelect", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // UI-01
  it("renders only the active Requesters returned by the API as options", async () => {
    const requesters = [
      { id: 1, name: "Alex Rivera" },
      { id: 2, name: "Sam Okafor" },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(requesters)));

    renderScreen();

    expect(await screen.findByRole("option", { name: "Alex Rivera" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sam Okafor" })).toBeInTheDocument();
    // Placeholder option plus the two Requesters — nothing extra rendered.
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  // UI-02
  it("keeps Continue disabled until a Requester is selected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse([{ id: 1, name: "Alex Rivera" }])),
    );

    renderScreen();

    const continueBtn = await screen.findByRole("button", { name: "Continue" });
    expect(continueBtn).toBeDisabled();

    await userEvent.selectOptions(screen.getByLabelText("Development Requester"), "1");
    expect(continueBtn).toBeEnabled();
  });

  // UI-03
  it("writes the selection to sessionStorage and navigates to My Tickets on Continue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse([{ id: 1, name: "Alex Rivera" }])),
    );

    renderScreen();

    await userEvent.selectOptions(await screen.findByLabelText("Development Requester"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(getSelectedRequester()).toEqual({ id: 1, name: "Alex Rivera" });
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
  });

  // UI-04
  it("shows a spinner and Loading Requesters… while the request is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise(() => {})),
    );

    renderScreen();

    expect(screen.getByText("Loading Requesters…")).toBeInTheDocument();
  });

  // UI-05
  it("shows the empty-state message and keeps Continue disabled when no Requesters are active", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderScreen();

    expect(
      await screen.findByText("No active Development Requesters are available."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  // UI-06
  it("shows a failure banner with Retry on API failure, which then loads normally", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, false, 500))
      .mockResolvedValueOnce(jsonResponse([{ id: 1, name: "Alex Rivera" }]));
    vi.stubGlobal("fetch", fetchMock);

    renderScreen();

    const message = await screen.findByText("Couldn't load Development Requesters.");
    expect(message.closest(".state-banner--error")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("option", { name: "Alex Rivera" })).toBeInTheDocument();
  });
});
