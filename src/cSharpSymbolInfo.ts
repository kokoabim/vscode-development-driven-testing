import './regExpExtensions';
import * as vscode from 'vscode';
import { CSharpTypeInfo } from './CSharpTypeInfo';
import { CSharpMethodParameterInfo } from './cSharpMethodParameterInfo';
import { CSharpSymbolGenericInfo } from './CSharpSymbolGenericInfo';

/**
 * C# code information
 */
export interface ICSharpSymbolInfo {
    returnType: CSharpTypeInfo | undefined;
    signature: string;
    symbolGenerics: CSharpSymbolGenericInfo[] | undefined;
    symbolName: string;
}

export interface ICSharpSymbolWithParametersInfo {
    parameters: CSharpMethodParameterInfo[];
}

/**
 * C# code information
 */
export abstract class CSharpSymbolInfo implements ICSharpSymbolInfo {
    returnType: CSharpTypeInfo | undefined;
    signature: string;
    symbolGenerics: CSharpSymbolGenericInfo[] | undefined;
    symbolName: string;

    protected _symbolParameters: string | undefined;

    private _genericsExpression: RegExp = /(?<generic>[a-z0-9_]+\??)/gi;
    private _keywords: string[] | undefined;
    private _keywordsAndReturnTypeExpression: RegExp = /^(?<keywords>((public|internal|protected|private|abstract|virtual|override|partial|sealed|async|new) +)*)?(?<type>.*?) *$/gi;
    private _signatureExpression: RegExp = /^(?<name>[^\<\(]+) *(\<(?<generics>.*?)\>)? *(\((?<params>.*?)\))?/i;

    constructor(documentSymbol: vscode.DocumentSymbol, textDocument: vscode.TextDocument) {
        this.signature = documentSymbol.name;

        if (documentSymbol.kind === vscode.SymbolKind.Namespace) {
            this._keywords = ['public'];
            this.symbolName = this.signature;
            return;
        }

        const signatureMatch = this._signatureExpression.exec(this.signature);
        if (!signatureMatch || !signatureMatch.groups) { throw new Error(`Signature '${this.signature}' is not valid.`); }
        if (signatureMatch.groups.generics) { this.symbolGenerics = this._genericsExpression.matchGroupValues(signatureMatch.groups.generics, 'generic').map(g => new CSharpSymbolGenericInfo(g)); }
        this.symbolName = signatureMatch.groups.name;
        this._symbolParameters = signatureMatch.groups.params;

        const keywordsAndReturnType = textDocument.getText(new vscode.Range(documentSymbol.range.start, documentSymbol.selectionRange.start));
        const keywordsAndReturnTypeMatch = this._keywordsAndReturnTypeExpression.exec(keywordsAndReturnType);
        if (!keywordsAndReturnTypeMatch || !keywordsAndReturnTypeMatch.groups) { throw new Error(`Keywords and return type '${keywordsAndReturnType}' is not valid.`); }
        this._keywords = keywordsAndReturnTypeMatch.groups.keywords.trim().split(/ +/);
        if (documentSymbol.kind === vscode.SymbolKind.Method) { this.returnType = new CSharpTypeInfo(keywordsAndReturnTypeMatch.groups.type); }
    }

    isAbstract(): boolean { return this._keywords?.includes('abstract') ?? false; }

    isPublic(): boolean { return this._keywords?.includes('public') ?? false; }

    isStatic(): boolean { return this._keywords?.includes('static') ?? false; }
}
