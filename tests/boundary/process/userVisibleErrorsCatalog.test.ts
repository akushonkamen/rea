import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = join(import.meta.dirname, "..", "..", "..");

/**
 * Minimal RFC 4180 parser: the catalogue uses quoted fields containing
 * commas and embedded newlines, so naive `line.split(",")` is not enough.
 */
const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      field = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else if (character !== "\r") {
      field += character;
    }
  }
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
};

const cataloguePath = join(repositoryRoot, "docs", "user-visible-errors.csv");
const catalogueRows = parseCsv(readFileSync(cataloguePath, "utf8"));
const [header, ...dataRows] = catalogueRows;
if (header === undefined) throw new Error("Catalogue CSV has no header row");
const column = (name: string): number => {
  const index = header.indexOf(name);
  if (index < 0) throw new Error(`Catalogue is missing column ${name}`);
  return index;
};
const locationColumn = column("location");
const statusColumn = column("implementation_status");
const textColumns = [column("trigger"), column("proposed_replacement")];

/** Byte-size mentions such as `64 MiB`, `512 KiB`, `1024 bytes`. */
const sizePattern = /\b(\d+(?:\.\d+)?)\s*(MiB|KiB|GiB|bytes)\b/g;

const sourceText = readFileSync(
  join(repositoryRoot, "src", "application", "process", "ProcessCli.ts"),
  "utf8",
);
describe("user-visible-errors catalogue consistency", () => {
  it("keeps every implemented row's byte-size limit present in the process input source", () => {
    const failures: string[] = [];
    for (const row of dataRows) {
      if (row[statusColumn] !== "implemented") continue;
      const text = textColumns.map((c) => row[c]).join(" ");
      for (const [, size, unit] of text.matchAll(sizePattern)) {
        const present = [`${size} ${unit}`, `${size}${unit}`].some((form) =>
          sourceText.includes(form),
        );
        if (!present) {
          failures.push(
            `row ${row[locationColumn]} claims implemented limit ${size} ${unit} with no match in ProcessCli.ts`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("no longer marks the removed 64 MiB process-input boundary as implemented", () => {
    const sizeRow = dataRows.find(
      (row) =>
        row[locationColumn] ===
        "src/application/process/ProcessCli.ts:readJson size",
    );
    expect(sizeRow).toBeDefined();
    expect(sizeRow?.[statusColumn]).not.toBe("implemented");
  });
});
