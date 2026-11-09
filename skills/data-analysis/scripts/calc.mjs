#!/usr/bin/env node
/**
 * calc — the arithmetic between figures the other scripts gave: a
 * difference, a growth rate, a ratio, a share. Numbers, + - * / and brackets,
 * nothing else; each expression may be named.
 *
 * Usage: node scripts/calc.mjs "<expression>" ["<name>=<expression>" …] [--decimals <n>]
 *
 *   node scripts/calc.mjs "growth=(2150-1550.5)/1550.5*100" "gap=2150-1550.5"
 *
 * Prints { results: [{ name?, expression, value }] }; --decimals rounds (default 4).
 */
import { parseArgs, usage, out, fail, tidy, isMain, EXIT_OK } from "./lib/table.mjs";

const USAGE = `
Usage: node scripts/calc.mjs "<expression>" ["<name>=<expression>" …] [--decimals <n>]

Numbers (dot for decimals), + - * / and brackets. Exit 0, 1 when an
expression cannot be computed, 2 on a bad invocation.
`;

/** A recursive-descent evaluator: no eval, no name, no function. */
export function evaluate(expression) {
  const text = expression.replace(/[\s  _]/g, "");
  let at = 0;
  const peek = () => text[at];
  const factor = () => {
    if (peek() === "+") {
      at++;
      return factor();
    }
    if (peek() === "-") {
      at++;
      return -factor();
    }
    if (peek() === "(") {
      at++;
      const value = sum();
      if (peek() !== ")") throw new Error(`"${expression}": a bracket is not closed`);
      at++;
      return value;
    }
    const m = /^(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?/.exec(text.slice(at));
    if (!m) throw new Error(`"${expression}": a number is expected at position ${at + 1}`);
    at += m[0].length;
    return Number(m[0]);
  };
  const product = () => {
    let value = factor();
    while (peek() === "*" || peek() === "/") {
      const op = text[at++];
      const right = factor();
      if (op === "/" && right === 0) throw new Error(`"${expression}": division by zero`);
      value = op === "*" ? value * right : value / right;
    }
    return value;
  };
  const sum = () => {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const op = text[at++];
      const right = product();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };
  if (!text) throw new Error("empty expression");
  const value = sum();
  if (at < text.length) throw new Error(`"${expression}": unexpected "${text[at]}" at position ${at + 1}`);
  return value;
}

if (isMain(import.meta)) {
  const { flags, positional } = parseArgs();
  if (flags.help || !positional.length) usage(USAGE);
  const decimals = Math.min(10, Math.max(0, Number(flags.decimals ?? 4)));
  if (!Number.isInteger(decimals)) usage(USAGE);
  try {
    const results = positional.map((item) => {
      const named = /^([A-Za-z][\w .-]*)=(.+)$/.exec(item);
      const expression = named ? named[2] : item;
      const value = Number(tidy(evaluate(expression)).toFixed(decimals));
      return { ...(named ? { name: named[1].trim() } : {}), expression, value };
    });
    out({ results });
    process.exit(EXIT_OK);
  } catch (error) {
    fail(error.message);
  }
}
