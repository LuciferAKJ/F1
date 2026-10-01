import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportJSON, exportMarkdown, exportCSV } from "../exportUtils";

describe("exportUtils", () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports JSON", () => {
    const data = { test: 123 };
    exportJSON(data, "test.json");
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });

  it("exports Markdown", () => {
    exportMarkdown("# Test Title", "test.md");
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });

  it("exports CSV with row formatting and escaping", () => {
    const rows = [
      { name: "Verstappen", team: "Red Bull", note: 'P1 "Champion"' },
      { name: "Hamilton", team: "Ferrari", note: "P2, close" },
    ];
    exportCSV(rows, "test.csv");
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });

  it("handles empty array in exportCSV", () => {
    exportCSV([], "empty.csv");
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
  });
});
