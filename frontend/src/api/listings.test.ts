import { describe, it, expect } from "vitest";
import { mapListing, listingBody, patchForStatus, type ListingInput } from "./listings";

describe("mapListing", () => {
  it("maps a Supabase row, coerces ids to strings and defaults arrays", () => {
    const l = mapListing({
      id: "l1",
      unit_id: "u1",
      title: "A",
      rent_amount: "15000",
      deposit_amount: null,
      status: "draft",
      views_count: null,
      photos: null,
      amenities: null,
      created_at: "2026-01-01",
      units: {
        id: "u1",
        unit_number: "101",
        bedroom_count: 2,
        bathroom_count: 1,
        properties: { name: "IJE Heights", city: "Makati" },
      },
    });
    expect(l.id).toBe("l1");
    expect(l.rent_amount).toBe(15000);
    expect(l.photos).toEqual([]);
    expect(l.amenities).toEqual([]);
    expect(l.views_count).toBe(0);
    expect(l.unit?.properties?.name).toBe("IJE Heights");
  });

  it("maps rows without a unit join (unit stays undefined, not null)", () => {
    const l = mapListing({ id: "l2", title: "B", created_at: "" });
    expect(l.unit).toBeUndefined();
  });
});

describe("listingBody", () => {
  it("keeps only columns that exist on the listings table", () => {
    const body: Record<string, unknown> = {
      unit_id: "u1",
      title: "T",
      rent_amount: 5000,
      slug: "not-a-real-column",
    };
    const row = listingBody(body as Partial<ListingInput>);
    expect(row.unit_id).toBe("u1");
    expect(row.rent_amount).toBe(5000);
    expect(row.slug).toBeUndefined();
  });

  it("drops undefined so Supabase update leaves them untouched", () => {
    expect(listingBody({ title: "T", description: undefined })).toEqual({
      title: "T",
    });
  });
});

describe("patchForStatus", () => {
  it("stamps published_at only when publishing", () => {
    const publish = patchForStatus("published");
    expect(publish.status).toBe("published");
    expect(typeof publish.published_at).toBe("string");
    expect(patchForStatus("draft").published_at).toBeUndefined();
    expect(patchForStatus("closed")).toEqual({ status: "closed" });
  });
});
