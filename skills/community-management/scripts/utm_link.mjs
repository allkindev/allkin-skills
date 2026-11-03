#!/usr/bin/env node
/**
 * utm_link — builds the tracked form of a link for one network.
 *
 *   node scripts/utm_link.mjs <url> --network x [--campaign id] [--medium social] [--content …] [--source]
 *
 * utm_source is the network id (or, with --source, the handle of the account
 * of that network in accounts.json without its @), utm_medium "social" unless
 * given, utm_campaign the campaign (a calendar entry id as a rule), utm_content
 * when given. Existing query parameters and the fragment are kept, existing
 * utm_* parameters replaced, every value percent-encoded. A link that is not
 * http(s) is left alone and reported as an issue (exit 1).
 *
 * Output: { url, tracked, issues }.
 */
import { EXIT_ISSUES, EXIT_OK, accountFor, fail, isMain, networkSpec, out, parseArgs, usage, workspaceDir } from "./lib/common.mjs";

const USAGE = `
Usage: node scripts/utm_link.mjs <url> --network x [--campaign id] [--medium social] [--content …] [--source] [--workspace dir]
  --source   utm_source = the account's handle (accounts.json) instead of the network id
`;

/**
 * The tracked link. `options`: { medium = "social", content, source } where
 * `source` replaces the network id as utm_source. Returns { tracked, issues }:
 * `tracked` is null when the url cannot be tracked.
 */
export function buildUtmLink(url, network, campaign, options = {}) {
  const issues = [];
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    return { tracked: null, issues: [`not a URL: ${url}`] };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { tracked: null, issues: [`not an http(s) link, left untouched: ${url}`] };
  }
  const params = [];
  for (const [key, value] of new URLSearchParams(parsed.search)) {
    if (/^utm_/i.test(key)) continue;
    params.push([key, value]);
  }
  const utm = {
    utm_source: options.source || network,
    utm_medium: options.medium || "social",
    utm_campaign: campaign || null,
    utm_content: options.content || null,
  };
  for (const [key, value] of Object.entries(utm)) {
    if (value !== null && value !== undefined && String(value) !== "") params.push([key, String(value)]);
  }
  const query = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  parsed.search = query ? `?${query}` : "";
  return { tracked: parsed.toString(), issues };
}

function main() {
  const { command: url, flags } = parseArgs();
  if (flags.help || !url || !flags.network || flags.network === true) usage(USAGE);
  const network = String(flags.network);
  networkSpec(network); // exits 2 on an unknown network
  const options = {
    medium: flags.medium && flags.medium !== true ? String(flags.medium) : "social",
    content: flags.content && flags.content !== true ? String(flags.content) : null,
  };
  if (flags.source) {
    const account = accountFor(workspaceDir(flags), network);
    if (!account?.handle) fail(`No account of ${network} in accounts.json to take the handle from`);
    options.source = String(account.handle).replace(/^@/, "");
  }
  const campaign = flags.campaign && flags.campaign !== true ? String(flags.campaign) : null;
  const { tracked, issues } = buildUtmLink(url, network, campaign, options);
  out({ url, tracked, issues }, flags);
  process.exit(issues.length ? EXIT_ISSUES : EXIT_OK);
}

if (isMain(import.meta.url)) main();
