import { describe, it, expect } from "vitest";
import { ilikeTerm, mapBody, mapProperty, type PropertyUpdateBody } from "../api/properties";

describe("ilikeTerm", () => {
  it("strips PostgREST filter operators from user search input", () => {
    expect(ilikeTerm("a,b(c)%x'\"\\")).toBe("a b c  x");
    expect(ilikeTerm("plain")).toBe("plain");
  });
});

describe("mapBody", () => {
  it("keeps only columns that exist on the properties table", () => {
    const body: PropertyUpdateBody & { latitude?: number } = {
      name: "IJE Heights",
      address: "123",
      latitude: 14.5,
      active: true,
    };
    const row = mapBody(body);
    expect(row.name).toBe("IJE Heights");
    expect(row.active).toBe(true);
    expect(row.latitude).toBeUndefined();
  });

  it("drops undefined values so Supabase PATCH leaves them untouched", () => {
    expect(mapBody({ city: null, state: undefined })).toEqual({ city: null });
  });
});

describe("mapProperty", () => {
  it("maps a Supabase row and defaults active to true", () => {
    const p = mapProperty({ id: "u1", name: "A", address: "B", created_at: "2026-01-01" });
    expect(p.id).toBe("u1");
    expect(p.active).toBe(true);
  });
});
