import { describe, expect, it } from "vitest";
import { parseCsv, parseJson } from "./data";

describe("data assets", () => {
  it("parses quoted CSV values and numeric cells", () => {
    expect(parseCsv('region,value\n"North, East",42')).toEqual([{ region: "North, East", value: 42 }]);
  });

  it("normalizes JSON records into rows", () => {
    expect(parseJson('[{"name":"Launch","score":91}]')).toEqual([{ name: "Launch", score: 91 }]);
  });
});
