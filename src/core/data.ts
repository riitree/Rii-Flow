import type { DataCell, DataRow } from "../types";

function parseCell(raw: string): DataCell {
  const value = raw.trim();
  if (!value) return "";
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function csvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
}

export function parseCsv(text: string): DataRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV needs a header and at least one row.");
  const headers = csvLine(lines[0]).map((value, index) => value.trim() || `Column ${index + 1}`);
  return lines.slice(1, 101).map((line) => {
    const values = csvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, parseCell(values[index] ?? "")]));
  });
}

export function parseJson(text: string): DataRow[] {
  const parsed: unknown = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  if (!items.length) throw new Error("JSON contains no rows.");
  return items.slice(0, 100).map((item, index) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).map(([key, value]) => [
        key,
        value === null || ["string", "number", "boolean"].includes(typeof value)
          ? value as DataCell
          : JSON.stringify(value)
      ]));
    }
    return { row: index + 1, value: String(item) };
  });
}
