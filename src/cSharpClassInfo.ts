import * as vscode from 'vscode';
import { CSharpSymbolInfo, ICSharpSymbolInfo } from './cSharpSymbolInfo';
import { CSharpMethodInfo } from './cSharpMethodInfo';
import { CSharpConstructorInfo } from './cSharpConstructorInfo';

/**
 * C# class information
 */
export class CSharpClassInfo extends CSharpSymbolInfo implements ICSharpSymbolInfo {
    constructors: CSharpConstructorInfo[];
    methods: CSharpMethodInfo[];
    namespace: string;

    constructor(namespace: string, documentSymbol: vscode.DocumentSymbol, textDocument: vscode.TextDocument) {
        super(documentSymbol, textDocument);

        this.constructors = documentSymbol.children.filter(ds => ds.kind === vscode.SymbolKind.Constructor).map(ds => new CSharpConstructorInfo(ds, textDocument));
        this.methods = documentSymbol.children.filter(ds => ds.kind === vscode.SymbolKind.Method).map(ds => new CSharpMethodInfo(ds, textDocument));
        this.namespace = namespace;
    }
}
