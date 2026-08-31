import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AttachmentPicker from "../../src/components/AttachmentPicker.js";

function Wrapper() {
  const [files, setFiles] = useState<File[]>([]);
  return <AttachmentPicker files={files} onChange={setFiles} />;
}

function makeFile(name: string, sizeBytes: number, type: string): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("AttachmentPicker", () => {
  // UI-14
  it("flags a file over 5 MB as an invalid chip, excluded from submission", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const bigFile = makeFile("photo.png", 6 * 1024 * 1024, "image/png");

    await user.upload(screen.getByLabelText("Attachments"), bigFile);

    const chip = screen.getByText("photo.png").closest(".attachment-picker__chip");
    expect(chip).toHaveClass("attachment-picker__chip--invalid");
    expect(screen.getByText("File exceeds 5 MB")).toBeInTheDocument();
  });

  // UI-15
  it("flags an unsupported file type as an invalid chip, excluded from submission", async () => {
    // applyAccept: false — a real user (or a renamed file) can still submit
    // a file the input's `accept` attribute would normally filter out; the
    // component's own check must catch it regardless.
    const user = userEvent.setup({ applyAccept: false });
    render(<Wrapper />);
    const badFile = makeFile("script.exe", 1024, "application/x-msdownload");

    await user.upload(screen.getByLabelText("Attachments"), badFile);

    const chip = screen.getByText("script.exe").closest(".attachment-picker__chip");
    expect(chip).toHaveClass("attachment-picker__chip--invalid");
    expect(screen.getByText("Unsupported file type")).toBeInTheDocument();
  });

  // UI-16
  it("rejects a 6th file with a batch-level banner when 5 are already selected", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const input = screen.getByLabelText("Attachments");

    for (let i = 0; i < 5; i++) {
      await user.upload(input, makeFile(`file-${i}.png`, 1024, "image/png"));
    }
    expect(screen.getAllByRole("listitem")).toHaveLength(5);

    await user.upload(input, makeFile("file-6.png", 1024, "image/png"));

    expect(screen.getByText("Up to 5 attachments allowed")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByText("file-6.png")).not.toBeInTheDocument();
  });

  // UI-17
  it("removes a file from the selection when its ✕ control is clicked", async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.upload(
      screen.getByLabelText("Attachments"),
      makeFile("note.pdf", 1024, "application/pdf"),
    );

    expect(screen.getByText("note.pdf")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove note.pdf" }));

    expect(screen.queryByText("note.pdf")).not.toBeInTheDocument();
  });
});
