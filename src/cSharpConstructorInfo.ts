import * as vscode from 'vscode';
import { CSharpMethodParameterInfo } from './cSharpMethodParameterInfo';
import { CSharpSymbolInfo, ICSharpSymbolInfo, ICSharpSymbolWithParametersInfo } from './cSharpSymbolInfo';

/**
 * C# constructor information
 */
export class CSharpConstructorInfo extends CSharpSymbolInfo implements ICSharpSymbolInfo, ICSharpSymbolWithParametersInfo {
    parameters: CSharpMethodParameterInfo[];

    constructor(documentSymbol: vscode.DocumentSymbol, textDocument: vscode.TextDocument) {
        super(documentSymbol, textDocument);
        this.parameters = CSharpMethodParameterInfo.create(this._symbolParameters);
    }
}
