import * as vscode from "vscode";
import { DevelopmentDrivenTestingVSCodeExtension } from "./VSCodeExtension/DevelopmentDrivenTestingVSCodeExtension";

export function activate(context: vscode.ExtensionContext) {
    DevelopmentDrivenTestingVSCodeExtension.use(context);
}

export function deactivate() { }
