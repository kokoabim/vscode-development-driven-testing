import { glob } from "glob";
import { basename, dirname } from "path";
import * as vscode from "vscode";

import { Executor } from "../../Utils/Executor";
import * as fs from "fs/promises";

export class CSharpProjectFile {
    private fileContents: string | undefined;

    public assemblyName!: string;
    public defaultNamespace!: string;
    public directory: string;
    public isTestProject = false;
    public name: string;
    public solutionFilePath: string | undefined;
    public targetFramework: string | undefined;
    public workspaceFolder: string | undefined;

    constructor(public filePath: string, public relativePath: string) {
        this.directory = dirname(filePath);
        this.name = basename(filePath, ".csproj");
        this.relativePath = relativePath;
    }

    static async findProjectsAsync(workspaceFolder: vscode.WorkspaceFolder): Promise<CSharpProjectFile[]> {
        return await CSharpProjectFile.findProjectsUnderDirectoryAsync(workspaceFolder.uri.fsPath, true);
    }

    static async findProjectsUnderDirectoryAsync(directory: string, isWorkspaceFolder = false): Promise<CSharpProjectFile[]> {
        return await glob(directory + '/**/*.csproj').then(async files => {
            const cSharpProjectFiles = files.map(f => {
                const projectFile = new CSharpProjectFile(f, f.replace(directory + "/", ""));
                if (isWorkspaceFolder) projectFile.workspaceFolder = directory;
                return projectFile;
            });
            for await (const f of cSharpProjectFiles) { await f.readFilePropertiesAsync(); }
            return cSharpProjectFiles;
        }, error => {
            throw error;
        });
    }

    async addPackageReferenceAsync(packageName: string, packageVersion?: string): Promise<[boolean, string]> {
        const [dotNetExitCode, dotNetOutput] = await Executor.execToString(`dotnet add "${this.filePath}" package ${packageName} ${packageVersion ? `--version ${packageVersion}` : ""}`, this.directory);
        return [dotNetExitCode === 0, dotNetOutput];
    }

    async buildAsync(outputChannel: vscode.OutputChannel, prefix = "", showFilePath = true): Promise<boolean> {
        outputChannel.append(`${prefix}${showFilePath ? `[Project: ${this.name}] ` : ""}Building project...`);

        // eslint-disable-next-line no-unused-vars
        const [dotNetExitCode, dotNetBuildOutput] = await Executor.execToString(`dotnet build -v m "${this.filePath}"`, this.directory);
        if (dotNetExitCode === 0) {
            outputChannel.appendLine(" succeeded");
            return true;
        }
        else {
            outputChannel.appendLine(" failed");
            return false;
        }
    }

    async buildSolutionAsync(outputChannel: vscode.OutputChannel, prefix = "", showFilePath = true): Promise<boolean> {
        if (!this.solutionFilePath) {
            outputChannel.appendLine(`${prefix}No solution file found`);
            return false;
        }

        outputChannel.append(`${prefix}${showFilePath ? `[Solution: ${basename(this.solutionFilePath, ".sln")}] ` : ""}Building solution...`);

        // eslint-disable-next-line no-unused-vars
        const [dotNetExitCode, dotNetOutput] = await Executor.execToString(`dotnet build -v m "${this.solutionFilePath}"`, this.workspaceFolder!);
        if (dotNetExitCode === 0) {
            outputChannel.appendLine(` succeeded`);
            return true;
        }
        else {
            outputChannel.appendLine(` failed ❌`);
            return false;
        }
    }

    async getCSharpFileUris(): Promise<vscode.Uri[]> {
        return await this.getFileUrisByExtension("cs");
    }

    async getFileUrisByExtension(extension: string): Promise<vscode.Uri[]> {
        return (await vscode.workspace.findFiles(`**/*.${extension}`)).filter(f =>
            f.path.includes(this.directory + "/")
            && !f.path.includes("/bin/Debug/")
            && !f.path.includes("/obj/Debug/")
            && !f.path.includes("/bin/Release/")
            && !f.path.includes("/obj/Release/")
        );
    }

    async getPackageReferencesAsync(): Promise<CSharpProjectPackageReference[]> {
        await CSharpProjectFile.readFileAsStringAsync(this.filePath).then(contents => {
            this.fileContents = contents;
        }, error => {
            throw error;
        });

        let m;
        let packageReferences: CSharpProjectPackageReference[] = [];

        CSharpProjectPackageReference.regExp.lastIndex = 0;
        while ((m = CSharpProjectPackageReference.regExp.exec(this.fileContents!)) !== null) {
            if (m.groups) packageReferences.push(new CSharpProjectPackageReference(m[0], m.groups.name, m.groups.version));
        }

        if (packageReferences.length > 0) packageReferences = packageReferences.sort((a, b) => a.name.localeCompare(b.name));

        return packageReferences;
    }

    async getProjectReferencesAsync(): Promise<CSharpProjectProjectReference[]> {
        await CSharpProjectFile.readFileAsStringAsync(this.filePath).then(contents => {
            this.fileContents = contents;
        }, error => {
            throw error;
        });

        let m;
        let projectReferences: CSharpProjectProjectReference[] = [];

        CSharpProjectProjectReference.regExp.lastIndex = 0;
        while ((m = CSharpProjectProjectReference.regExp.exec(this.fileContents!)) !== null) {
            if (m.groups) projectReferences.push(new CSharpProjectProjectReference(m[0], m.groups.path));
        }

        if (projectReferences.length > 0) projectReferences = projectReferences.sort((a, b) => a.path.localeCompare(b.path));

        return projectReferences;
    }

    getProperty(name: string): string | undefined {
        return this.fileContents?.match(new RegExp(`<${name}>(.*)</${name}>`, "i"))?.[1];
    }

    async removePackageReferenceAsync(reference: CSharpProjectPackageReference): Promise<[boolean, string]> {
        const [dotNetExitCode, dotNetOutput] = await Executor.execToString(`dotnet remove "${this.filePath}" package ${reference.name}`, this.directory);
        return [dotNetExitCode === 0, dotNetOutput];
    }

    private static async readFileAsStringAsync(filePath: string): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            await fs.readFile(filePath).then(data => {
                resolve(Buffer.from(<Uint8Array>data).toString("utf8"));
            }, err => {
                reject(err);
            });
        });
    }

    private async getSolutionFilePath(): Promise<string | undefined> {
        if (!this.workspaceFolder) return undefined;

        const solutionFilePaths = await glob(this.workspaceFolder + '/*.sln');
        if (solutionFilePaths.length === 0) return undefined;

        for await (const solutionFilePath of solutionFilePaths) {
            const solutionContents = await CSharpProjectFile.readFileAsStringAsync(solutionFilePath);
            if (solutionContents.includes("\"" + this.relativePath.replace(/\//g, "\\") + "\"")) return solutionFilePath;
        }

        return undefined;
    }

    private async readFilePropertiesAsync(): Promise<void> {
        await CSharpProjectFile.readFileAsStringAsync(this.filePath).then(contents => {
            this.fileContents = contents;
        }, error => {
            throw error;
        });

        this.assemblyName = this.name;

        this.solutionFilePath = await this.getSolutionFilePath();

        if (this.fileContents) {
            const assemblyName = this.getProperty("AssemblyName");
            if (assemblyName) this.assemblyName = assemblyName;

            this.defaultNamespace = this.getProperty("RootNamespace") || assemblyName || this.name || "";
            this.isTestProject = this.getProperty("IsTestProject")?.localeCompare("true", undefined, { sensitivity: "accent" }) === 0;
            this.targetFramework = this.getProperty("TargetFramework");
        }
    }
}

export class CSharpProjectPackageReference {
    static readonly regExp = /(^[ \t]*)?<PackageReference\s+Include="(?<name>[^"]*)"\s+Version="(?<version>[^"]*)"([^>]*?\/>|.*<\/PackageReference>)([ \t]*$)?/gs;

    constructor(public readonly match: string, public readonly name: string, public readonly version: string) { }
}

export class CSharpProjectProjectReference {
    static readonly regExp = /(^[ \t]*)?<ProjectReference\s+Include="(?<path>[^"]*)"([^>]*?\/>|.*<\/ProjectReference>)([ \t]*$)?/gs;

    readonly name: string;

    constructor(public readonly match: string, public readonly path: string) {
        this.name = basename(path, ".csproj");
    }
}
