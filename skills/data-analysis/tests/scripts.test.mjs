/**
 * Tests of the competence's scripts: profile, aggregate, chart, and the
 * reading of CSV and .xlsx files. Run from the skill folder:
 *
 *   node --test tests/
 *
 * Each test works in a temporary folder; nothing of the skill folder is touched.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { deflateRawSync, crc32 } from "node:zlib";

import {
  parseCsv, detectDelimiter, decimalSeparator, toNumber, toDate, dateOrder, serialToIso, sum, describe as stats, loadTable, columnInfo,
} from "../scripts/lib/table.mjs";
import { isoWeek, period } from "../scripts/aggregate.mjs";
import { niceTicks, formatNumber } from "../scripts/chart.mjs";
import { evaluate } from "../scripts/calc.mjs";

const SCRIPTS = join(resolve(dirname(fileURLToPath(import.meta.url)), ".."), "scripts");
let dir;

before(() => {
  dir = mkdtempSync(join(tmpdir(), "data-analysis-"));
});
after(() => rmSync(dir, { recursive: true, force: true }));

/** Runs a script in the temporary folder; returns { code, json, stderr } without throwing. */
function run(script, args) {
  try {
    const stdout = execFileSync(process.execPath, [join(SCRIPTS, `${script}.mjs`), ...args], { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, json: JSON.parse(stdout) };
  } catch (error) {
    let json = null;
    try {
      json = JSON.parse(error.stdout);
    } catch {}
    return { code: error.status, json, stderr: String(error.stderr) };
  }
}

/** A zip with deflated entries: enough to write a small .xlsx by hand. */
function zip(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, "utf-8");
    const packed = deflateRawSync(data);
    const nameBytes = Buffer.from(name, "utf-8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, packed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(crc32(data), 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += 30 + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function workbook() {
  return zip({
    "[Content_Types].xml": "<Types/>",
    "xl/workbook.xml": '<workbook xmlns:r="x"><sheets><sheet name="Notes" sheetId="1" r:id="rId1"/><sheet name="Sales &amp; Co" sheetId="2" r:id="rId2"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
    "xl/sharedStrings.xml": '<sst><si><t>Date</t></si><si><t>Client</t></si><si><t>Amount</t></si><si><r><t>Dupont </t></r><r><t>&amp; Fils</t></r></si><si><t>Martin</t></si><si><t>Paid</t></si></sst>',
    "xl/styles.xml": '<styleSheet><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="164"/></cellXfs></styleSheet>',
    "xl/worksheets/sheet1.xml": '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>hello</t></is></c></row></sheetData></worksheet>',
    "xl/worksheets/sheet2.xml":
      '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>5</v></c></row>' +
      '<row r="2"><c r="A2" s="1"><v>46023</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" s="2"><v>1200.5</v></c><c r="D2" t="b"><v>1</v></c></row>' +
      '<row r="4"><c r="A4" s="1"><v>46054</v></c><c r="B4" t="s"><v>4</v></c><c r="C4" s="2"><f>C2*2</f><v>2401</v></c><c r="D4" t="b"><v>0</v></c></row>' +
      "</sheetData></worksheet>",
  });
}

describe("reading", () => {
  test("csv: quotes, doubled quotes, newlines inside a field", () => {
    assert.deepEqual(parseCsv('a,b\n"x, y","he said ""no"""\n"two\nlines",3\n', ","), [["a", "b"], ["x, y", 'he said "no"'], ["two\nlines", "3"]]);
  });
  test("csv: the delimiter is found outside quotes", () => {
    assert.equal(detectDelimiter('name;amount\n"a,b,c,d";1,5\n"e";2,5\n'), ";");
    assert.equal(detectDelimiter("a\tb\tc\n1\t2\t3\n"), "\t");
    assert.equal(detectDelimiter("a,b\n1,2\n"), ",");
  });
  test("numbers: the decimal separator is decided on the column", () => {
    assert.equal(decimalSeparator(["1.234,56", "12,5"], "."), ",");
    assert.equal(decimalSeparator(["1,234.56", "12.5"], ","), ".");
    assert.equal(decimalSeparator(["12,5", "3,25"], "."), ",");
    assert.equal(decimalSeparator(["1,234", "2,345"], "."), ".");
    assert.equal(decimalSeparator(["1,234", "2,345"], ","), ",");
    assert.equal(toNumber("1 234,56 €", ","), 1234.56);
    assert.equal(toNumber("$1,234.56", "."), 1234.56);
    assert.equal(toNumber("(250)", "."), -250);
    assert.equal(toNumber("12,5 %", ","), 12.5);
    assert.equal(toNumber("− 3", "."), -3);
    assert.equal(toNumber("n/a", "."), null);
    assert.equal(toNumber("2026-01-05", "."), null);
  });
  test("dates: iso, local, their order, impossible ones", () => {
    assert.equal(toDate("2026-03-09"), "2026-03-09");
    assert.equal(toDate("2026-03-09T14:30:00Z"), "2026-03-09");
    assert.equal(toDate("09/03/2026", "dmy"), "2026-03-09");
    assert.equal(toDate("09/03/2026", "mdy"), "2026-09-03");
    assert.equal(toDate("31.12.25", "dmy"), "2025-12-31");
    assert.equal(toDate("31/02/2026", "dmy"), null);
    assert.equal(dateOrder(["01/02/2026", "25/02/2026"]), "dmy");
    assert.equal(dateOrder(["01/02/2026", "02/25/2026"]), "mdy");
    assert.equal(dateOrder(["01/02/2026", "03/04/2026"]), null);
  });
  test("excel serial dates", () => {
    assert.equal(serialToIso(46023, false), "2026-01-01");
    assert.equal(serialToIso(1, false), "1899-12-31");
    assert.equal(serialToIso(46023.5, true), "2026-01-01T12:00:00");
  });
  test("sums are exact to the cent", () => {
    assert.equal(Number(sum(Array(1000).fill(0.1)).toFixed(10)), 100);
    assert.equal(stats([0.1, 0.2]).sum, 0.3);
    assert.equal(stats([1, 2, 3, 4]).median, 2.5);
  });
  test("xlsx: a named sheet, shared and rich strings, dates, booleans, a gap in the rows", () => {
    writeFileSync(join(dir, "book.xlsx"), workbook());
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      const first = loadTable("book.xlsx");
      assert.equal(first.source.sheet, "Notes");
      assert.deepEqual(first.source.sheets, ["Notes", "Sales & Co"]);
      const table = loadTable("book.xlsx", { sheet: "Sales & Co" });
      assert.deepEqual(table.columns, ["Date", "Client", "Amount", "Paid"]);
      assert.deepEqual(table.rows, [["2026-01-01", "Dupont & Fils", "1200.5", "TRUE"], ["2026-02-01", "Martin", "2401", "FALSE"]]);
      assert.equal(table.source.formulas, 1);
      assert.equal(columnInfo(table, 0).type, "date");
      assert.equal(columnInfo(table, 2).type, "number");
      assert.deepEqual(loadTable("book.xlsx", { sheet: "2" }).columns, table.columns);
      assert.throws(() => loadTable("book.xlsx", { sheet: "Nope" }), /no sheet/);
    } finally {
      process.chdir(cwd);
    }
  });
});

describe("profile", () => {
  test("a European CSV: types, figures, warnings", () => {
    writeFileSync(
      join(dir, "ventes.csv"),
      "﻿Date;Client;Ville;Montant;Remise\n" +
        "05/01/2026;Dupont;Lyon;1 200,50;10 %\n" +
        "17/01/2026;Martin;lyon;350,00;\n" +
        "03/02/2026;Dupont;Paris;99,90;5 %\n" +
        "03/02/2026;Dupont;Paris;99,90;5 %\n" +
        "28/02/2026;Bernard;Paris;n/a;0 %\n" +
        "01/03/2026;Petit;Lille;2 000;\n" +
        "02/03/2026;Petit;Lille;10;\n" +
        "03/03/2026;Petit;Lille;20;\n" +
        "04/03/2026;Petit;Lille;30;\n" +
        "05/03/2026;Petit;Lille;40;\n" +
        "06/03/2026;Petit;Lille;50;\n",
      "utf-8"
    );
    const { code, json } = run("profile", ["ventes.csv"]);
    assert.equal(code, 0);
    assert.equal(json.rows, 11);
    assert.equal(json.source.delimiter, ";");
    const by = Object.fromEntries(json.columns.map((c) => [c.name, c]));
    assert.equal(by.Date.type, "date");
    assert.equal(by.Date.order, "dmy");
    assert.equal(by.Date.first, "2026-01-05");
    assert.equal(by.Date.last, "2026-03-06");
    assert.equal(by.Montant.type, "number");
    assert.equal(by.Montant.decimal, ",");
    assert.equal(by.Montant.count, 10);
    assert.equal(by.Montant.unreadable, 1);
    assert.equal(by.Montant.sum, 3900.3);
    assert.equal(by.Montant.max, 2000);
    assert.equal(by.Remise.percent, true);
    assert.equal(by.Remise.missing, 7);
    assert.equal(by.Ville.caseVariants, 1);
    assert.equal(by.Client.top[0].value, "Petit");
    assert.equal(json.duplicateRows, 1);
    assert.ok(json.warnings.some((w) => w.includes("Montant")));
  });
  test("a missing file fails with exit 1, a missing argument with exit 2", () => {
    assert.equal(run("profile", ["nope.csv"]).code, 1);
    assert.equal(run("profile", []).code, 2);
  });
  test("ambiguous dates are said to be", () => {
    writeFileSync(join(dir, "amb.csv"), "d,v\n01/02/2026,1\n03/04/2026,2\n");
    const { json } = run("profile", ["amb.csv"]);
    assert.equal(json.columns[0].ambiguous, true);
    assert.equal(run("profile", ["amb.csv", "--dates", "dmy"]).json.columns[0].ambiguous, undefined);
  });
});

describe("aggregate", () => {
  test("periods", () => {
    assert.equal(period("2026-05-17", "quarter"), "2026-Q2");
    assert.equal(period("2026-05-17", "month"), "2026-05");
    assert.equal(isoWeek("2026-01-01"), "2026-W01");
    assert.equal(isoWeek("2027-01-01"), "2026-W53");
    assert.equal(isoWeek("2026-11-09"), "2026-W46");
  });
  test("group, sum, share, sort, and the cells left out", () => {
    const { code, json } = run("aggregate", ["ventes.csv", "--group", "Client", "--agg", "sum:Montant,count,mean:Montant", "--share", "--sort", "-sum_Montant"]);
    assert.equal(code, 0);
    assert.equal(json.matched, 11);
    assert.equal(json.groups, 4);
    assert.deepEqual(json.result.map((r) => r.Client), ["Petit", "Dupont", "Martin", "Bernard"]);
    assert.equal(json.result[0].sum_Montant, 2150);
    assert.equal(json.result[1].sum_Montant, 1400.3);
    assert.equal(json.result[1].count, 3);
    assert.equal(json.result[3].sum_Montant, 0);
    assert.equal(json.result[3].mean_Montant, null);
    assert.equal(json.total.sum_Montant, 3900.3);
    assert.equal(json.ignored.Montant, 1);
    assert.equal(Number(json.result.reduce((s, r) => s + r.share_sum_Montant, 0).toFixed(4)), 1);
  });
  test("filters on text, numbers and dates; groups by month; writes a CSV", () => {
    const paris = run("aggregate", ["ventes.csv", "--where", "Ville=LYON", "--agg", "count"]);
    assert.equal(paris.json.result[0].count, 2);
    const big = run("aggregate", ["ventes.csv", "--where", "Montant>=100", "--where", "Date<2026-03-01", "--agg", "count,sum:Montant"]);
    assert.deepEqual(big.json.result[0], { count: 2, sum_Montant: 1550.5 });
    const empty = run("aggregate", ["ventes.csv", "--where", "Remise=", "--agg", "count"]);
    assert.equal(empty.json.result[0].count, 7);
    const months = run("aggregate", ["ventes.csv", "--group", "month:Date", "--agg", "sum:Montant", "--out", "out/months.csv"]);
    assert.deepEqual(months.json.result, [
      { month_Date: "2026-01", sum_Montant: 1550.5 },
      { month_Date: "2026-02", sum_Montant: 199.8 },
      { month_Date: "2026-03", sum_Montant: 2150 },
    ]);
    assert.equal(readFileSync(join(dir, "out/months.csv"), "utf-8"), "month_Date,sum_Montant\n2026-01,1550.5\n2026-02,199.8\n2026-03,2150\n");
  });
  test("a wrong column or function is an error that names the choices", () => {
    const bad = run("aggregate", ["ventes.csv", "--agg", "sum:Prix"]);
    assert.equal(bad.code, 1);
    assert.match(bad.json.error, /columns: Date, Client/);
    assert.equal(run("aggregate", ["ventes.csv", "--agg", "sum:Client"]).code, 1);
    assert.equal(run("aggregate", ["ventes.csv", "--agg", "avg:Montant"]).code, 1);
    assert.equal(run("aggregate", ["ventes.csv"]).code, 2);
  });
  test("an .xlsx sheet is aggregated like a CSV", () => {
    const { json } = run("aggregate", ["book.xlsx", "--sheet", "Sales & Co", "--group", "month:Date", "--agg", "sum:Amount"]);
    assert.deepEqual(json.result, [{ month_Date: "2026-01", sum_Amount: 1200.5 }, { month_Date: "2026-02", sum_Amount: 2401 }]);
  });
});

describe("chart", () => {
  test("ticks and number format", () => {
    assert.deepEqual(niceTicks(0, 2150).ticks, [0, 500, 1000, 1500, 2000, 2500]);
    assert.deepEqual(niceTicks(0, 0).ticks.at(-1), 1);
    assert.equal(formatNumber(1234567.4), "1 234 567");
    assert.equal(formatNumber(12.345), "12.35");
  });
  test("bar, hbar and line are written as SVG", () => {
    for (const type of ["bar", "hbar", "line"]) {
      const { code, json } = run("chart", ["out/months.csv", "--x", "month_Date", "--y", "sum_Montant", "--type", type, "--title", "Sales <2026>", "--unit", "€", "--out", `out/${type}.svg`]);
      assert.equal(code, 0, type);
      assert.equal(json.points, 3);
      const svg = readFileSync(join(dir, `out/${type}.svg`), "utf-8");
      assert.ok(svg.startsWith("<svg "));
      assert.ok(svg.includes("Sales &lt;2026&gt;"));
      assert.ok(!svg.includes("NaN"));
    }
  });
  test("a text column cannot be drawn; too many bars are refused", () => {
    assert.equal(run("chart", ["ventes.csv", "--x", "Client", "--y", "Ville", "--out", "x.svg"]).code, 1);
    writeFileSync(join(dir, "many.csv"), "k,v\n" + Array.from({ length: 45 }, (_, i) => `k${i},${i}`).join("\n") + "\n");
    const many = run("chart", ["many.csv", "--x", "k", "--y", "v", "--out", "many.svg"]);
    assert.equal(many.code, 1);
    assert.ok(!existsSync(join(dir, "many.svg")));
    assert.equal(run("chart", ["many.csv", "--x", "k", "--y", "v", "--out", "many.svg", "--limit", "20"]).json.dropped, 25);
  });
});

describe("calc", () => {
  test("arithmetic with precedence, brackets and signs; nothing else", () => {
    assert.equal(evaluate("1 + 2 * 3"), 7);
    assert.equal(evaluate("(1+2)*3"), 9);
    assert.equal(evaluate("-(4-10)/3"), 2);
    assert.equal(evaluate("1 200.5 * 2"), 2401);
    assert.throws(() => evaluate("2*(3+1"), /bracket/);
    assert.throws(() => evaluate("1/0"), /zero/);
    assert.throws(() => evaluate("process.exit(1)"), /number is expected/);
    assert.throws(() => evaluate("2 3 +"), /number is expected|unexpected/);
  });
  test("named expressions, rounded", () => {
    const { code, json } = run("calc", ["growth=(2150-1550.5)/1550.5*100", "0.1+0.2", "--decimals", "2"]);
    assert.equal(code, 0);
    assert.deepEqual(json.results, [{ name: "growth", expression: "(2150-1550.5)/1550.5*100", value: 38.66 }, { expression: "0.1+0.2", value: 0.3 }]);
    assert.equal(run("calc", ["2*x"]).code, 1);
    assert.equal(run("calc", []).code, 2);
  });
});
