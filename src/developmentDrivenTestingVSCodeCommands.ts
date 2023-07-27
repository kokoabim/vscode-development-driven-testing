import * as vscode from 'vscode';
import { CSharpNamespaceInfo } from './cSharpNamespaceInfo';
import { CSharpXunitTestClass } from './cSharpXunitTestClass';
import { CSharpXunitTestGenerateSettings } from './cSharpXunitTestGenerateSettings';

/**
 * Development-Driven Testing (DDT) VS Code extension commands
 */
export class DevelopmentDrivenTestingVSCodeCommands {
    commands: VSCodeCommand[] = [];

    constructor() {
        this.commands.push(this.createCopyTestClassWithTestMethodsCommand());
    }

    private createCopyTestClassWithTestMethodsCommand(): VSCodeCommand {
        return new VSCodeCommand('kokoabim.ddt.copy-test-class-with-test-methods', () => {
            const doc = vscode.window.activeTextEditor?.document;
            if (!doc || doc.languageId !== 'csharp') {
                vscode.window.showWarningMessage('This command is for C# files.');
                return;
            }

            const editConfig = vscode.workspace.getConfiguration('editor');
            const extensionConfig = vscode.workspace.getConfiguration('ddt');

            const generateSettings = new CSharpXunitTestGenerateSettings();
            generateSettings.indentation = editConfig.get('insertSpaces') as boolean ? ' '.repeat(editConfig.get('tabSize') as number) : '\t';
            generateSettings.indicateTypeNullability = extensionConfig.get('indicateTypeNullability') as boolean;
            generateSettings.objectTypeForGenericParameters = extensionConfig.get('objectTypeForGenericParameters') as boolean;
            generateSettings.typesNotToBeIndicatedAsNullable = extensionConfig.get('typesNotToBeIndicatedAsNullable') as string[];

            vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', doc.uri).then(ds => {
                const documentSymbols = ds as vscode.DocumentSymbol[];

                const namespaces = documentSymbols.filter(ds => ds.kind === vscode.SymbolKind.Namespace).map(ds => new CSharpNamespaceInfo(ds, doc!));
                if (namespaces.length === 0) {
                    vscode.window.showWarningMessage('No namespaces found in current file.');
                    return;
                }

                namespaces.forEach(ns => {
                    ns.classes.filter(c => c.isPublic() && !c.isStatic() && !c.isAbstract()).forEach(c => {
                        const testClass = new CSharpXunitTestClass(c);
                        vscode.env.clipboard.writeText(testClass.generate(generateSettings));
                        vscode.window.showInformationMessage(`Generated test class with test methods for ${c.symbolName} sent to clipboard.`);
                    });
                });
            });
        });
    }
}

export class VSCodeCommand {
    constructor(
        public name: string,
        public command: (...args: any[]) => any,
    ) { }
}