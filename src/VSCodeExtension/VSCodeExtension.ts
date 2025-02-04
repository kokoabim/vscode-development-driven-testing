import * as vscode from "vscode";

import { FileInfo } from "../Utils/FileInfo";
import { VSCodeCommand } from "./VSCodeCommand";
import { FileSystem } from "../Utils/FileSystem";

export abstract class VSCodeExtension {
    protected configurationSection: string | undefined;
    protected context: vscode.ExtensionContext;
    protected extensionName: string;
    protected outputChannel: vscode.OutputChannel;
    protected shortName: string;
    protected workspaceFolder: vscode.WorkspaceFolder | undefined;

    constructor(context: vscode.ExtensionContext, configurationSection: string | undefined = undefined) {
        this.context = context;
        this.configurationSection = configurationSection;
        this.extensionName = this.packageProperty("displayName");
        this.shortName = this.packageProperty("shortName");

        this.outputChannel = vscode.window.createOutputChannel(this.extensionName);
    }

    protected get isWorkspaceOpen(): boolean { return !!vscode.workspace.workspaceFolders; }

    protected addCommands(...commands: VSCodeCommand[]) {
        commands.forEach(c => {
            this.context.subscriptions.push(vscode.commands.registerCommand(c.name, c.command));
        });
    }

    protected configurationProperty<T>(name: string): T | undefined {
        if (!this.configurationSection) { return undefined; }
        const configuration = vscode.workspace.getConfiguration(this.configurationSection);
        if (!configuration) { return undefined; }
        try { return configuration.get<T>(name); }
        catch { return undefined; }
    }

    protected async error(message: string): Promise<void> {
        await vscode.window.showErrorMessage(`${this.shortName}: ${message}`);
    }

    protected async information(message: string): Promise<void> {
        await vscode.window.showInformationMessage(`${this.shortName}: ${message}`);
    }

    protected isWorkspaceReady(): boolean {
        if (!this.isWorkspaceOpen) {
            vscode.window.showWarningMessage(`No workspace is open.`);
            return false;
        }

        this.workspaceFolder = vscode.workspace.workspaceFolders![0];

        this.outputChannel.show(true);

        return true;
    }

    protected output(message: string, show = false, preserveFocus = true): void {
        if (show) this.outputChannel.show(preserveFocus);
        this.outputChannel.append(message);
    }

    protected outputLine(message: string, show = false, preserveFocus = true): void {
        if (show) this.outputChannel.show(preserveFocus);
        this.outputChannel.appendLine(message);
    }

    protected packageProperty(name: string): any {
        return this.context.extension.packageJSON[name];
    }

    protected showOutput(preserveFocus = true): void {
        this.outputChannel.show(preserveFocus);
    }

    protected async warning(message: string): Promise<void> {
        await vscode.window.showWarningMessage(`${this.shortName}: ${message}`);
    }

    protected async workspaceFiles(include?: string, exclude?: string): Promise<FileInfo[]> {
        const files = await FileSystem.getFileInfosAsync(this.workspaceFolder!.uri.path);
        return include || exclude ? FileInfo.match(files, include, exclude) : files;
    }

    protected workspacePath(...relativePath: string[]): string {
        return vscode.Uri.joinPath(this.workspaceFolder!.uri, ...relativePath).path;
    }
}
