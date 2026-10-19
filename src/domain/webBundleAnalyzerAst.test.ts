import * as t from "@babel/types";
import { expect, it } from "vitest";

import { parseJavaScriptSource } from "./javascript/javascriptSourceParser.js";
import { objectString, objectValue } from "./webBundleAnalyzerAst.js";

it("reads WebMCP declaration strings through the exact-literal owner", () => {
  const file = parseJavaScriptSource(
    "const declaration = { name: `catalog`, description: `Browse catalog` }; const dynamic = { name: `catalog ${scope}` };",
  );
  const declaration = file?.program.body[0];
  if (!t.isVariableDeclaration(declaration))
    throw new Error("Expected declaration fixture");
  const object = declaration.declarations[0]?.init;
  if (!t.isObjectExpression(object))
    throw new Error("Expected object expression fixture");
  const dynamicDeclaration = file?.program.body[1];
  if (!t.isVariableDeclaration(dynamicDeclaration))
    throw new Error("Expected dynamic declaration fixture");
  const dynamic = dynamicDeclaration.declarations[0]?.init;
  if (!t.isObjectExpression(dynamic))
    throw new Error("Expected dynamic object expression fixture");

  expect(objectString(object, "name")).toBe("catalog");
  expect(objectString(object, "description")).toBe("Browse catalog");
  expect(objectString(dynamic, "name")).toBeUndefined();
});

it("resolves inline literal spreads without erasing explicit metadata", () => {
  const file = parseJavaScriptSource(
    [
      // Metadata supplied entirely by an inline literal spread.
      "const fromSpread = {...{name: `catalog`, description: `Browse catalog`, inputSchema: {properties: {q: {}}}}};",
      // An unrelated inline literal spread after explicit metadata.
      "const trailingSpread = {name: `catalog`, description: `Browse catalog`, inputSchema: {properties: {q: {}}}, ...{timeout: 5}};",
      // Dynamic spread stays unknown.
      "const dynamicSpread = {name: `catalog`, ...dynamic};",
      // A later explicit key still overrides the spread.
      "const overridden = {...{name: `catalog`}, name: `other`};",
    ].join(" "),
  );
  if (!file) throw new Error("Expected parsed fixture");
  const objects = file.program.body.flatMap((statement) => {
    if (!t.isVariableDeclaration(statement)) return [];
    const init = statement.declarations[0]?.init;
    return t.isObjectExpression(init) ? [init] : [];
  });
  const [fromSpread, trailingSpread, dynamicSpread, overridden] = objects;
  if (
    fromSpread === undefined ||
    trailingSpread === undefined ||
    dynamicSpread === undefined ||
    overridden === undefined
  )
    throw new Error("Expected object expression fixtures");

  expect(objectString(fromSpread, "name")).toBe("catalog");
  expect(objectString(fromSpread, "description")).toBe("Browse catalog");
  const schema = objectValue(fromSpread, "inputSchema");
  if (!t.isObjectExpression(schema)) throw new Error("Expected schema object");
  const properties = objectValue(schema, "properties");
  if (!t.isObjectExpression(properties))
    throw new Error("Expected properties object");
  expect(
    properties.properties.filter((property) => t.isObjectProperty(property)),
  ).toHaveLength(1);

  expect(objectString(trailingSpread, "name")).toBe("catalog");
  expect(objectString(trailingSpread, "description")).toBe("Browse catalog");

  expect(objectString(dynamicSpread, "name")).toBeUndefined();
  expect(objectString(overridden, "name")).toBe("other");
});
