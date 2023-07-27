import * as vscode from 'vscode';
import { DevelopmentDrivenTestingVSCodeCommands } from './developmentDrivenTestingVSCodeCommands';

export function activate(context: vscode.ExtensionContext) {
    const vsCodeCommands = new DevelopmentDrivenTestingVSCodeCommands();

    vsCodeCommands.commands.forEach(c => {
        context.subscriptions.push(vscode.commands.registerCommand(c.name, c.command));
    });
}

export function deactivate() { }
