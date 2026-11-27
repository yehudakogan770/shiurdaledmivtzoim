import { findPlace } from "@/components/address-input";

/** Where routes start from: 770 Eastern Parkway, Crown Heights. */
export const CROWN_HEIGHTS = { lat: 40.6694, lon: -73.9422 };
type Point = { lat: number; lon: number };

/** Straight-line distance, enough to pick the closest next stop in a city. */
function km(a: Point, b: Point) {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

/**
 * The order to visit places in: from Crown Heights to the closest one, then the closest one from
 * there, and so on. Places with no address, or that the map can't find, keep their order at the end.
 */
export async function orderByDistance<T extends { address?: string | null }>(items: T[]): Promise<T[]> {
  const found = await Promise.all(items.map(async (item) => ({ item, at: item.address?.trim() ? await findPlace(item.address) : null })));
  const left = found.filter((f) => f.at);
  const order: T[] = [];
  let from: Point = CROWN_HEIGHTS;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (km(from, left[i].at!) < km(from, left[best].at!)) best = i;
    const [next] = left.splice(best, 1);
    order.push(next.item);
    from = next.at!;
  }
  return [...order, ...found.filter((f) => !f.at).map((f) => f.item)];
}
