/**
 * The adapters by network id. `adapterFor(id)` returns { network, comments(json, options),
 * metrics(json) } — the Meta networks bound to meta.mjs — or null for a network without
 * adapter (tiktok, pinterest: the user pastes). `networkOfFile(name)` reads the network id
 * from a raw file's name: the prefix before the first "-" (`x-mentions-2026-11-01.json` → x).
 */
import { basename } from "node:path";
import * as x from "./x.mjs";
import * as meta from "./meta.mjs";
import * as linkedin from "./linkedin.mjs";
import * as youtube from "./youtube.mjs";
import * as mastodon from "./mastodon.mjs";
import * as bluesky from "./bluesky.mjs";

const SINGLE = { x, linkedin, youtube, mastodon, bluesky };

export const ADAPTED_NETWORKS = [...Object.keys(SINGLE), ...meta.networks];

export function adapterFor(networkId) {
  const id = String(networkId ?? "").toLowerCase();
  if (SINGLE[id]) {
    const mod = SINGLE[id];
    return { network: id, comments: (json, options = {}) => mod.comments(json, options), metrics: (json) => mod.metrics(json) };
  }
  if (meta.networks.includes(id)) {
    return { network: id, comments: (json, options = {}) => meta.comments(json, id, options), metrics: (json) => meta.metrics(json, id) };
  }
  return null;
}

export function networkOfFile(fileName) {
  const name = basename(String(fileName ?? ""));
  const dash = name.indexOf("-");
  const prefix = (dash > 0 ? name.slice(0, dash) : name.replace(/\.[^.]+$/, "")).toLowerCase();
  return prefix || null;
}
