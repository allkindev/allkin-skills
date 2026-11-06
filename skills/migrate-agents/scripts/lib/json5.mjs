/**
 * A tolerant reader for JSON5, the format of OpenClaw's configuration:
 * comments, trailing commas, unquoted keys, single-quoted strings, hex and
 * signed numbers, Infinity / NaN. Enough to read a configuration, not a
 * validator: what it cannot read throws with the position.
 */
export function parseJson5(text) {
  let i = 0;
  const s = String(text).replace(/^﻿/, "");

  const error = (message) => {
    const line = s.slice(0, i).split("\n").length;
    throw new Error(`${message} (line ${line})`);
  };

  function skip() {
    for (;;) {
      while (i < s.length && /\s/.test(s[i])) i++;
      if (s.startsWith("//", i)) {
        while (i < s.length && s[i] !== "\n") i++;
      } else if (s.startsWith("/*", i)) {
        const end = s.indexOf("*/", i + 2);
        i = end < 0 ? s.length : end + 2;
      } else return;
    }
  }

  function string() {
    const quote = s[i++];
    let value = "";
    while (i < s.length && s[i] !== quote) {
      if (s[i] === "\\") {
        const c = s[++i];
        if (c === "n") value += "\n";
        else if (c === "t") value += "\t";
        else if (c === "r") value += "\r";
        else if (c === "b") value += "\b";
        else if (c === "f") value += "\f";
        else if (c === "u") {
          value += String.fromCharCode(parseInt(s.slice(i + 1, i + 5), 16));
          i += 4;
        } else if (c === "\n") {
          /* line continuation */
        } else value += c;
        i++;
      } else value += s[i++];
    }
    if (s[i] !== quote) error("unterminated string");
    i++;
    return value;
  }

  function identifier() {
    const match = /^[A-Za-z_$][A-Za-z0-9_$-]*/.exec(s.slice(i));
    if (!match) error(`unexpected character ${JSON.stringify(s[i] ?? "end")}`);
    i += match[0].length;
    return match[0];
  }

  function value() {
    skip();
    const c = s[i];
    if (c === "{") return object();
    if (c === "[") return array();
    if (c === '"' || c === "'") return string();
    const number = /^[+-]?(0x[0-9a-fA-F]+|Infinity|NaN|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)/.exec(s.slice(i));
    if (number) {
      i += number[0].length;
      const raw = number[0].replace(/^\+/, "");
      if (/0x/i.test(raw)) return (raw.startsWith("-") ? -1 : 1) * parseInt(raw.replace(/^-/, ""), 16);
      return Number(raw);
    }
    const word = identifier();
    if (word === "true") return true;
    if (word === "false") return false;
    if (word === "null") return null;
    error(`unexpected word ${word}`);
  }

  function object() {
    i++;
    const result = {};
    for (;;) {
      skip();
      if (s[i] === "}") {
        i++;
        return result;
      }
      const key = s[i] === '"' || s[i] === "'" ? string() : identifier();
      skip();
      if (s[i++] !== ":") error("expected ':'");
      result[key] = value();
      skip();
      if (s[i] === ",") i++;
      else if (s[i] !== "}") error("expected ',' or '}'");
    }
  }

  function array() {
    i++;
    const result = [];
    for (;;) {
      skip();
      if (s[i] === "]") {
        i++;
        return result;
      }
      result.push(value());
      skip();
      if (s[i] === ",") i++;
      else if (s[i] !== "]") error("expected ',' or ']'");
    }
  }

  const result = value();
  skip();
  if (i < s.length) error("unexpected content after the end");
  return result;
}
