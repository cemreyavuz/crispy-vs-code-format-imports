import * as vscode from "vscode";
import * as ts from "typescript";

const ABSOLUTE_CUSTOM_MODULE_SPECIFIERS: string[] = [
  "common",
  "components",
  "modules",
  "routing",
  "state",
];
const RELATIVE_CUSTOM_MODULE_SPECIFIERS: string[] = [];
const RELATIVE_PATH_TOKENS = [".", "..", "/"];

enum CrispyImportGroup {
  React = "react",
  Absolute = "absolute",
  AbsoluteCustom = "absolute-custom",
  Relative = "relative",
  RelativeCustom = "relative-custom",
}

type GroupedImports = Record<string, ts.Node[] | Record<string, ts.Node[]>>;

export const formatImports = (): void => {
  if (vscode.window.activeTextEditor) {
    const content = vscode.window.activeTextEditor.document.getText();

    const sourceFile: ts.SourceFile = ts.createSourceFile(
      "test",
      content,
      ts.ScriptTarget.ES2015,
      true
    );
    const children: ts.Node[] = [];
    sourceFile.forEachChild<ts.Node>((node) => {
      children.push(node);

      return undefined;
    });

    const imports = children?.filter((node) =>
      ts.isImportDeclaration(node)
    ) as ts.ImportDeclaration[];

    const start = imports[0].pos;
    const end = imports[imports.length - 1].end;

    const startLines = content.substr(0, start).split("\n");
    const endLines = content.substr(0, end).split("\n");
    const startLineNumber = startLines.length - 1;
    const endLineNumber = endLines.length - 1;
    const startPosition = new vscode.Position(
      startLineNumber,
      startLines[startLines.length - 1].length
    );
    const endPosition = new vscode.Position(
      endLineNumber,
      endLines[endLines.length - 1].length
    );

    const groupedImports = groupImports(imports);
    const sortedImports = sortImports(groupedImports);
    const mergedImports = mergeImports(sortedImports, content);

    const edits = [
      vscode.TextEdit.replace(
        new vscode.Range(startPosition, endPosition),
        mergedImports
      ),
    ];
    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.set(vscode.window.activeTextEditor.document.uri, edits);
    vscode.workspace.applyEdit(workspaceEdit);
  }
};

const mergeImports = (
  sortedImports: GroupedImports,
  content: string
): string => {
  let result = "";

  const addNewLineToResult = (): void => {
    result += "\n";
  };

  if (sortedImports[CrispyImportGroup.React].length > 0) {
    (sortedImports[CrispyImportGroup.React] as ts.ImportDeclaration[]).forEach(
      (node) => {
        const importDeclarationFullText = content
          .substring(node.pos, node.end)
          .trim();
        result += importDeclarationFullText;
        addNewLineToResult();
      }
    );
    addNewLineToResult();
  }

  if (sortedImports[CrispyImportGroup.Absolute].length > 0) {
    (sortedImports[
      CrispyImportGroup.Absolute
    ] as ts.ImportDeclaration[]).forEach((node) => {
      const importDeclarationFullText = content
        .substring(node.pos, node.end)
        .trim();
      result += importDeclarationFullText;
      addNewLineToResult();
    });
    addNewLineToResult();
  }

  if (Object.keys(sortedImports[CrispyImportGroup.AbsoluteCustom]).length > 0) {
    Object.keys(sortedImports[CrispyImportGroup.AbsoluteCustom]).forEach(
      (customSpecifier) => {
        (sortedImports[CrispyImportGroup.AbsoluteCustom] as Record<
          string,
          ts.Node[]
        >)[customSpecifier].forEach((node) => {
          const importDeclarationFullText = content
            .substring(node.pos, node.end)
            .trim();
          result += importDeclarationFullText;
          addNewLineToResult();
        });
        addNewLineToResult();
      }
    );
  }

  if (sortedImports[CrispyImportGroup.Relative].length > 0) {
    (sortedImports[
      CrispyImportGroup.Relative
    ] as ts.ImportDeclaration[]).forEach((node) => {
      const importDeclarationFullText = content
        .substring(node.pos, node.end)
        .trim();
      result += importDeclarationFullText;
      addNewLineToResult();
    });
  }

  if (Object.keys(sortedImports[CrispyImportGroup.RelativeCustom]).length > 0) {
    Object.keys(sortedImports[CrispyImportGroup.RelativeCustom]).forEach(
      (customSpecifier) => {
        (sortedImports[CrispyImportGroup.RelativeCustom] as Record<
          string,
          ts.Node[]
        >)[customSpecifier].forEach((node) => {
          const importDeclarationFullText = content
            .substring(node.pos, node.end)
            .trim();
          result += importDeclarationFullText;
          addNewLineToResult();
        });
      }
    );
    addNewLineToResult();
  }

  return result;
};

const compareImportDeclarations = (
  nodeA: ts.ImportDeclaration,
  nodeB: ts.ImportDeclaration
): number =>
  (nodeA.moduleSpecifier as ts.StringLiteral).text.localeCompare(
    (nodeB.moduleSpecifier as ts.StringLiteral).text
  );

const sortImports = (groupedImports: GroupedImports): GroupedImports => {
  const sortedImports: GroupedImports = {
    [CrispyImportGroup.React]: [],
    [CrispyImportGroup.Absolute]: [],
    [CrispyImportGroup.AbsoluteCustom]: {},
    [CrispyImportGroup.Relative]: [],
    [CrispyImportGroup.RelativeCustom]: {},
  };

  Object.keys(groupedImports).forEach((crispyImportGroup) => {
    switch (crispyImportGroup) {
      case CrispyImportGroup.React:
      case CrispyImportGroup.Absolute:
      case CrispyImportGroup.Relative:
        sortedImports[crispyImportGroup] = (groupedImports[
          crispyImportGroup
        ] as ts.ImportDeclaration[]).sort(compareImportDeclarations);
        break;
      case CrispyImportGroup.AbsoluteCustom:
      case CrispyImportGroup.RelativeCustom:
        Object.keys(groupedImports[crispyImportGroup]).forEach(
          (customSpecifier) => {
            (sortedImports[crispyImportGroup] as Record<string, ts.Node[]>)[
              customSpecifier
            ] = ((groupedImports[crispyImportGroup] as Record<
              string,
              ts.Node[]
            >)[customSpecifier] as ts.ImportDeclaration[]).sort(
              compareImportDeclarations
            );
          }
        );
        break;
      default:
        vscode.window.showWarningMessage(
          `Unknown crispy import group is ignored: ${crispyImportGroup}.`
        );
        break;
    }
  });

  return sortedImports;
};

const groupImports = (imports: ts.ImportDeclaration[]): GroupedImports => {
  const groupedImports: GroupedImports = {
    [CrispyImportGroup.React]: [],
    [CrispyImportGroup.Absolute]: [],
    [CrispyImportGroup.AbsoluteCustom]: {},
    [CrispyImportGroup.Relative]: [],
    [CrispyImportGroup.RelativeCustom]: {},
  };

  imports.forEach((node) => {
    const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;

    const { crispyImportGroup, customSpecifier = "" } = getCrispyImportGroup(
      moduleSpecifier
    );

    switch (crispyImportGroup) {
      case CrispyImportGroup.React:
      case CrispyImportGroup.Absolute:
      case CrispyImportGroup.Relative:
        (groupedImports[crispyImportGroup] as ts.Node[]).push(node);
        break;
      case CrispyImportGroup.AbsoluteCustom:
      case CrispyImportGroup.RelativeCustom:
        (groupedImports[crispyImportGroup] as Record<string, ts.Node[]>)[
          customSpecifier
        ] = [
          ...((groupedImports[crispyImportGroup] as Record<string, ts.Node[]>)[
            customSpecifier
          ] || []),
          node,
        ];
        break;
      default:
        vscode.window.showWarningMessage(
          `Unknown module specifier is ignored: ${moduleSpecifier}.`
        );
        break;
    }
  });

  return groupedImports;
};

const getCrispyImportGroup = (
  moduleSpecifier: string
): {
  crispyImportGroup: CrispyImportGroup;
  customSpecifier?: string;
} => {
  if (moduleSpecifier === "react") {
    return { crispyImportGroup: CrispyImportGroup.React };
  }

  if (RELATIVE_PATH_TOKENS.some((token) => moduleSpecifier.startsWith(token))) {
    const relativeCustomModuleSpecifierIndex = RELATIVE_CUSTOM_MODULE_SPECIFIERS.findIndex(
      (relativeCustomModuleSpecifier) =>
        moduleSpecifier.startsWith(relativeCustomModuleSpecifier)
    );
    if (relativeCustomModuleSpecifierIndex === -1) {
      return { crispyImportGroup: CrispyImportGroup.Relative };
    }

    return {
      crispyImportGroup: CrispyImportGroup.RelativeCustom,
      customSpecifier:
        ABSOLUTE_CUSTOM_MODULE_SPECIFIERS[relativeCustomModuleSpecifierIndex],
    };
  }

  const absoluteCustomModuleSpecifierIndex = ABSOLUTE_CUSTOM_MODULE_SPECIFIERS.findIndex(
    (absoluteCustomModuleSpecifier) =>
      moduleSpecifier.startsWith(absoluteCustomModuleSpecifier)
  );
  if (absoluteCustomModuleSpecifierIndex === -1) {
    return { crispyImportGroup: CrispyImportGroup.Absolute };
  }

  return {
    crispyImportGroup: CrispyImportGroup.AbsoluteCustom,
    customSpecifier:
      ABSOLUTE_CUSTOM_MODULE_SPECIFIERS[absoluteCustomModuleSpecifierIndex],
  };
};
