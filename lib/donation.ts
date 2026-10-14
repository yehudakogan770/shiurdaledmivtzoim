import type { SiteSettings } from "./types";

/** The "Partner in the Mivtzoim" box at the bottom of every page. */
export interface DonationInfo {
  title: string;
  text: string;
  cashtag: string;
  zelle: string;
}

export const DEFAULT_DONATION: DonationInfo = {
  title: "Partner in the Mivtzoim",
  text: "Your participation helps make the Mivtzoim possible.",
  cashtag: "$sdmivtzoim87",
  zelle: "sdmivtzoim87@gmail.com",
};

/** The Owner's wording for the box. It's kept in the site settings' spare "tagline" field. */
export function donationInfo(settings: SiteSettings): DonationInfo {
  try {
    const saved = JSON.parse(settings.tagline || "{}");
    const pick = (k: keyof DonationInfo) => (typeof saved[k] === "string" && saved[k].trim() ? saved[k].trim() : DEFAULT_DONATION[k]);
    return { title: pick("title"), text: pick("text"), cashtag: pick("cashtag"), zelle: pick("zelle") };
  } catch {
    return DEFAULT_DONATION;
  }
}

export function donationTagline(info: DonationInfo): string {
  return JSON.stringify(info);
}
