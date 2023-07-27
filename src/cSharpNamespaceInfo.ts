import * as vscode from 'vscode';
import { CSharpSymbolInfo, ICSharpSymbolInfo } from './cSharpSymbolInfo';
import { CSharpClassInfo } from './cSharpClassInfo';

/**
 * C# namespace information
 */
export class CSharpNamespaceInfo extends CSharpSymbolInfo implements ICSharpSymbolInfo {
    classes: CSharpClassInfo[];

    constructor(documentSymbol: vscode.DocumentSymbol, textDocument: vscode.TextDocument) {
        super(documentSymbol, textDocument);

        this.classes = documentSymbol.children.filter(ds => ds.kind === vscode.SymbolKind.Class).map(ds => new CSharpClassInfo(documentSymbol.name, ds, textDocument));
    }
}
