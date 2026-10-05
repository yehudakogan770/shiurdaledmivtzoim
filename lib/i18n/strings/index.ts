import common from "./common";
import shell from "./shell";
import login from "./login";
import dashboard from "./dashboard";
import routes from "./routes";
import photos from "./photos";
import history from "./history";
import profile from "./profile";
import admin from "./admin";
import data from "./data";
import overrides from "./overrides";
import type { Area } from "./types";

const AREAS: Area[] = [shell, login, dashboard, routes, photos, history, profile, admin, data, overrides, common];

/** All the translations together; the chosen versions (overrides) and shared words (common) win. */
export const STRINGS: Area = {
  he: Object.assign({}, ...AREAS.map((a) => a.he)),
  fr: Object.assign({}, ...AREAS.map((a) => a.fr)),
  es: Object.assign({}, ...AREAS.map((a) => a.es)),
};
