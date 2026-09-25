import { describe, expect, it } from "vitest";
import { validateActionFields } from "../../src/actionTakenValidation.js";

const valid = { description: "Replaced the battery", result: "Laptop powers on" };

function fieldsWithErrors(input: Parameters<typeof validateActionFields>[0]): string[] {
  return validateActionFields(input).errors.map((e) => e.field);
}

describe("Action Taken validation (BR-05, BR-06, BR-07)", () => {
  // UNIT-01
  it.each(["description", "result"] as const)("%s: empty and whitespace-only fail, 2000 passes, 2001 fails", (field) => {
    expect(fieldsWithErrors({ ...valid, [field]: "" })).toContain(field);
    expect(fieldsWithErrors({ ...valid, [field]: "   \n\t " })).toContain(field);
    expect(fieldsWithErrors({ ...valid, [field]: undefined })).toContain(field);
    expect(fieldsWithErrors({ ...valid, [field]: "x".repeat(2000) })).toEqual([]);
    expect(fieldsWithErrors({ ...valid, [field]: "x".repeat(2001) })).toContain(field);
  });

  it("trims description and result for storage", () => {
    const { value } = validateActionFields({ description: "  did a thing  ", result: " ok " });
    expect(value?.description).toBe("did a thing");
    expect(value?.result).toBe("ok");
  });

  // UNIT-02
  it("follow-up: required=true with empty note fails; with note passes; required=false drops the note", () => {
    expect(fieldsWithErrors({ ...valid, followUpRequired: true })).toEqual(["followUpNote"]);
    expect(fieldsWithErrors({ ...valid, followUpRequired: true, followUpNote: "   " })).toEqual(["followUpNote"]);
    expect(fieldsWithErrors({ ...valid, followUpRequired: true, followUpNote: "x".repeat(2001) })).toEqual(["followUpNote"]);

    const withNote = validateActionFields({ ...valid, followUpRequired: true, followUpNote: " call back " });
    expect(withNote.errors).toEqual([]);
    expect(withNote.value).toMatchObject({ followUpRequired: true, followUpNote: "call back" });

    const dropped = validateActionFields({ ...valid, followUpRequired: false, followUpNote: "ignored" });
    expect(dropped.errors).toEqual([]);
    expect(dropped.value).toMatchObject({ followUpRequired: false, followUpNote: null });
  });

  it("followUpRequired defaults to false and rejects non-boolean values", () => {
    expect(validateActionFields(valid).value).toMatchObject({ followUpRequired: false, followUpNote: null });
    expect(fieldsWithErrors({ ...valid, followUpRequired: "yes" as unknown as boolean })).toEqual(["followUpRequired"]);
  });

  // UNIT-03
  it("attachmentNotes: 500 passes, 501 fails, absent/blank stores null", () => {
    expect(fieldsWithErrors({ ...valid, attachmentNotes: "x".repeat(500) })).toEqual([]);
    expect(fieldsWithErrors({ ...valid, attachmentNotes: "x".repeat(501) })).toEqual(["attachmentNotes"]);
    expect(validateActionFields(valid).value?.attachmentNotes).toBeNull();
    expect(validateActionFields({ ...valid, attachmentNotes: "   " }).value?.attachmentNotes).toBeNull();
    expect(validateActionFields({ ...valid, attachmentNotes: " see photo " }).value?.attachmentNotes).toBe("see photo");
  });
});
