import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Settings > support mailto row. It must only render when SUPPORT_EMAIL is non-empty
 * (it is "" in a qa-sim build so the bundle carries no chess-school.in address).
 * Node vitest cannot render React Native, so this inspects the real settings.tsx AST:
 * the mailto Pressable must sit in the "true" branch of a `SUPPORT_EMAIL ? … : null`.
 */
const file = path.resolve(__dirname, "../app/settings.tsx");
const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function isSupportEmail(n: ts.Node): boolean {
  return ts.isIdentifier(n) && n.text === "SUPPORT_EMAIL";
}

function find<T extends ts.Node>(pred: (n: ts.Node) => n is T): T[] {
  const out: T[] = [];
  const visit = (n: ts.Node) => {
    if (pred(n)) out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** JSX elements whose own props mention a `mailto:` template/string. */
function mailtoElements(): ts.JsxElement[] {
  return find((n): n is ts.JsxElement => ts.isJsxElement(n)).filter((el) => {
    let hit = false;
    const visit = (n: ts.Node) => {
      if ((ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isStringLiteral(n))
        && n.getText(sf).includes("mailto:")) hit = true;
      ts.forEachChild(n, visit);
    };
    visit(el.openingElement);
    return hit;
  });
}

describe("settings.tsx support mailto row guard", () => {
  it("renders the mailto row only inside a `SUPPORT_EMAIL ? <row> : null` conditional", () => {
    const rows = mailtoElements();
    expect(rows).toHaveLength(1);
    let node: ts.Node = rows[0];
    let guard: ts.ConditionalExpression | undefined;
    while (node.parent) {
      node = node.parent;
      if (ts.isConditionalExpression(node)) { guard = node; break; }
      if (ts.isFunctionLike(node)) break;
    }
    expect(guard, "mailto row is not wrapped in a conditional").toBeDefined();
    // The test must be exactly the SUPPORT_EMAIL constant (not `true`, not a literal).
    expect(isSupportEmail(guard!.condition), `guard is ${guard!.condition.getText(sf)}`).toBe(true);
    // The row lives in the truthy branch, and the falsy branch renders nothing.
    expect(guard!.whenTrue.getFullText(sf)).toContain("mailto:");
    expect(guard!.whenFalse.kind).toBe(ts.SyntaxKind.NullKeyword);
  });

  it("the constant it reads is the shared one from @/constants", () => {
    const imp = find((n): n is ts.ImportDeclaration => ts.isImportDeclaration(n)).find(
      (d) => (d.moduleSpecifier as ts.StringLiteral).text === "@/constants",
    );
    expect(imp?.importClause?.namedBindings?.getText(sf)).toContain("SUPPORT_EMAIL");
  });

  it("collapses the version-line spacing only when the row is hidden", () => {
    expect(sf.getText()).toMatch(/!SUPPORT_EMAIL && styles\.versionAlone/);
  });
});
