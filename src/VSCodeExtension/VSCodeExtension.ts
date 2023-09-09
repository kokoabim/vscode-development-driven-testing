import * as vscode from "vscode";
import { VSCodeCommand } from "./VSCodeCommand";
import { FileInfo } from "../Utils/FileInfo";
import { FileSystem, IFileSystem } from "../Utils/FileSystem";

export abstract class VSCodeExtension {
    protected configurationSection: string | undefined;
    protected context: vscode.ExtensionContext;
    protected extensionName: string;
    protected fileSystem: IFileSystem = new FileSystem();

    protected get isWorkspaceOpen(): boolean { return !!vscode.workspace.workspaceFolders; }
    protected outputChannel: vscode.OutputChannel;
    protected workspaceFolder: vscode.WorkspaceFolder | undefined;

    constructor(context: vscode.ExtensionContext, configurationSection: string | undefined = undefined) {
        this.context = context;
        this.configurationSection = configurationSection;
        this.extensionName = this.packageProperty("displayName");

        this.outputChannel = vscode.window.createOutputChannel(this.extensionName);
    }

    protected addCommands(...commands: VSCodeCommand[]) {
        commands.forEach(c => {
            this.context.subscriptions.push(vscode.commands.registerCommand(c.name, c.command));
        });
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

    protected configurationProperty<T>(name: string): T | undefined {
        if (!this.configurationSection) { return undefined; }
        const configuration = vscode.workspace.getConfiguration(this.configurationSection);
        if (!configuration) { return undefined; }
        try { return configuration.get<T>(name); }
        catch { return undefined; }
    }

    protected packageProperty(name: string): any {
        return this.context.extension.packageJSON[name];
    }

    protected workspacePath(...relativePath: string[]): string {
        return vscode.Uri.joinPath(this.workspaceFolder!.uri, ...relativePath).path;
    }

    protected async workspaceFiles(include?: string, exclude?: string): Promise<FileInfo[]> {
        const files = await this.fileSystem.getFileInfos(this.workspaceFolder!.uri.path);
        return include || exclude ? FileInfo.match(files, include, exclude) : files;
    }
}
