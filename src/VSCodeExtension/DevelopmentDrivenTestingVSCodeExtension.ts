import * as vscode from "vscode";

import { CSharpParseSettings } from "../CSharp/CSharpParseSettings";
import { CSharpProjectFile } from "../CSharp/ProjectFile/CSharpProjectFile";
import { CSharpNamespace, VSCodeCSharp } from "../CSharp/VSCodeCSharp";
import { CSharpXunitTestClass } from "../CSharp/Xunit/CSharpXunitTestClass";
import { CSharpXunitTestGenerateSettings } from "../CSharp/Xunit/CSharpXunitTestGenerateSettings";
import { VSCodeCommand } from "./VSCodeCommand";
import { VSCodeExtension } from "./VSCodeExtension";
import { FileSystem } from "../Utils/FileSystem";

/**
 * Development-Driven Testing (DDT) VSCode extension
 */
export class DevelopmentDrivenTestingVSCodeExtension extends VSCodeExtension {
    private constructor(context: vscode.ExtensionContext) {
        super(context, "ddt");

        this.addCommands(
            this.createAddTestServiceProviderSupportCommand(),
            this.createCopyTestClassesForFileCommand(),
            this.createCreateTestFileForFileCommand(),
            this.createCreateTestFilesForProjectCommand());

        CSharpNamespace.defaultName = "DevelopmentDrivenTesting";
    }

    static use(context: vscode.ExtensionContext) {
        new DevelopmentDrivenTestingVSCodeExtension(context);
    }

    private async addTestServiceProviderSupportToProjectAsync(project: CSharpProjectFile): Promise<boolean> {
        const generateSettings = this.createGenerateSettings();

        this.outputLine(`\nAdding TestServiceProvider support to project ${project.name}...`, true);

        const templateFilePaths = await FileSystem.globAsync(FileSystem.joinPaths(this.context.extensionPath, "/CSharpTemplates/TestServiceProvider/", "*.cs"));
        if (templateFilePaths.length === 0) {
            this.outputChannel.appendLine("No TestServiceProvider template files found ❌");
            return false;
        }

        let fileAlreadyExists = false;
        for await (const f of templateFilePaths) {
            const fileName = FileSystem.basename(f);
            if (await FileSystem.existsAsync(FileSystem.joinPaths(project.directory, fileName))) {
                this.outputChannel.appendLine(`${fileName} file already exists in project ❌`);
                fileAlreadyExists = true;
            }
        }
        if (fileAlreadyExists) return false;

        const currentPackages = await project.getPackageReferencesAsync();
        const packageNamesNeeded = generateSettings.packagesForTestServiceProviderSupport.filter(p => !currentPackages.some(cp => cp.name === p));
        for await (const packageName of packageNamesNeeded) {
            this.output(`Adding package reference ${packageName} to project...`);
            const [dotNetSucceeded, dotNetOutput] = await project.addPackageReferenceAsync(packageName);
            if (dotNetSucceeded) this.outputLine(" succeeded ✅");
            else this.outputLine(` failed ❌\n${dotNetOutput}`);
        }

        this.output(`Adding TestServiceProvider classes...`);
        for await (const templateFilePath of templateFilePaths) {
            const classContent = await FileSystem.readFileAsync(templateFilePath);
            const targetFilePath = FileSystem.joinPaths(project.directory, FileSystem.basename(templateFilePath));
            await FileSystem.writeFile(targetFilePath, classContent);
            await vscode.window.showTextDocument(vscode.Uri.file(targetFilePath));
        }
        this.outputLine(" succeeded ✅");

        this.outputLine(`TestServiceProvider support added to project 🎉`);

        return true;
    }

    private async cSharpFileOrProjectOpenOrSelected(): Promise<[vscode.TextDocument | undefined, string | undefined]> {
        let document;
        try {
            document = vscode.window.activeTextEditor?.document;
            if (!document) {
                await vscode.commands.executeCommand('copyFilePath');
                const clipboard = await vscode.env.clipboard.readText();
                if (clipboard) { document = await vscode.workspace.openTextDocument(clipboard); }
            }
        }
        catch { }

        if (!document) {
            this.outputChannel.appendLine("No C# file or project is open or selected.");
            return [undefined, undefined];
        }
        const relativePath = vscode.workspace.asRelativePath(document.uri);
        return [document, relativePath];
    }

    private createAddTestServiceProviderSupportCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.ddt.add-testserviceprovider-support", async () => {
            if (!super.isWorkspaceReady()) return;

            const project = await this.getCSharpProjectFile("Select C# project to add TestServiceProvider support");
            if (!project) return;

            await this.addTestServiceProviderSupportToProjectAsync(project);
        });
    }

    private createCopyTestClassesForFileCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.ddt.copy-test-classes-for-file", async () => {
            if (!super.isWorkspaceReady()) { return; }
            const [document, documentRelativePath] = await this.cSharpFileOrProjectOpenOrSelected();
            if (!document) { return; }

            try {
                const testClasses = await this.createTestClassesForDocument(document);
                if (!testClasses) { return; }

                const generateSettings = this.createGenerateSettings();
                vscode.env.clipboard.writeText(testClasses.map(c => c.generate(generateSettings)).join("\n\n"));
            }
            catch (e: any) {
                this.outputChannel.appendLine(`${documentRelativePath}: ${e}`);
                return;
            }

            this.outputChannel.appendLine(`${documentRelativePath}: Sent C# Xunit test class(es) to clipboard.`);
        });
    }

    private createCreateTestFileForFileCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.ddt.create-test-file-for-file", async () => {
            if (!super.isWorkspaceReady()) { return; }
            const [document, documentRelativePath] = await this.cSharpFileOrProjectOpenOrSelected();
            if (!document) { return; }

            const testProject = await this.getCSharpTestProjectFile();
            if (!testProject) { return; }

            try {
                const testClasses = await this.createTestClassesForDocument(document);
                if (!testClasses) { return; }

                await this.writeOrAppendToTestFiles(testClasses, testProject);
            }
            catch (e: any) {
                this.outputChannel.appendLine(`${documentRelativePath}: ${e}`);
                return;
            }
        });
    }

    private createCreateTestFilesForProjectCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.ddt.create-test-files-for-project", async () => {
            if (!super.isWorkspaceReady()) { return; }

            // eslint-disable-next-line no-unused-vars
            const [document, documentRelativePath] = await this.cSharpFileOrProjectOpenOrSelected();
            if (!document) { return; }

            const cSharpProjectFiles = await CSharpProjectFile.findProjectsAsync(this.workspaceFolder!);
            if (cSharpProjectFiles.length === 0) {
                this.outputChannel.appendLine("No C# project found.");
                return;
            }

            const cSharpProjectFile = cSharpProjectFiles.find(p => document.uri.path.includes(p.directory + "/"));
            if (!cSharpProjectFile) {
                this.outputChannel.appendLine("No C# project found.");
                return;
            }
            else if (cSharpProjectFile.isTestProject) {
                this.outputChannel.appendLine(`${cSharpProjectFile.relativePath}: Open or selected C# file is in a test project. Open or select a C# file that is in a non-test project.`);
                return;
            }

            const cSharpFiles = (await vscode.workspace.findFiles("**/*.cs")).filter(f => f.path.includes(cSharpProjectFile.directory + "/"));
            if (cSharpFiles.length === 0) {
                this.outputChannel.appendLine(`${cSharpProjectFile.relativePath}: No C# files found.`);
                return;
            }

            const cSharpTestProjectFile = await this.getCSharpTestProjectFile();
            if (!cSharpTestProjectFile) { return; }

            if ("Yes" !== (await vscode.window.showInformationMessage(
                `Create C# Xunit test files?`,
                {
                    modal: true,
                    detail: `C# Xunit test files will be created, or append to, in project ${cSharpTestProjectFile.name} for ${cSharpFiles.length} C# files from project ${cSharpProjectFile.name}.`,
                },
                "Yes", "No"))) { return; }

            let testClasses: CSharpXunitTestClass[] = [];
            for await (const cSharpFile of cSharpFiles) {
                try {
                    const testClassesForFile = await this.createTestClassesForDocument(await vscode.workspace.openTextDocument(cSharpFile));
                    if (testClassesForFile) { testClasses.push(...testClassesForFile); }
                }
                catch (e: any) {
                    this.outputChannel.appendLine(`${vscode.workspace.asRelativePath(cSharpFile)}: ${e}`);
                }
            }

            if (testClasses.length === 0) {
                this.outputChannel.appendLine(`${cSharpProjectFile.relativePath}: No tests created.`);
                return;
            }

            await this.writeOrAppendToTestFiles(testClasses, cSharpTestProjectFile, false);
        });
    }

    private createGenerateSettings(): CSharpXunitTestGenerateSettings {
        const ddtConfig = vscode.workspace.getConfiguration(this.configurationSection);
        const editConfig = vscode.workspace.getConfiguration("editor");

        const settings = new CSharpXunitTestGenerateSettings();
        settings.addTestServiceProviderSupport = ddtConfig.get("addTestServiceProviderSupport") as boolean;
        settings.defaultNamespace = ddtConfig.get("defaultNamespace") as string;
        settings.disableCompilerWarnings = ddtConfig.get("disableCompilerWarnings") as boolean;
        settings.doNothingRegardingNullability = ddtConfig.get("doNothingRegardingNullability") as boolean;
        settings.indentation = editConfig.get("insertSpaces") as boolean ? " ".repeat(editConfig.get("tabSize") as number) : "\t";
        settings.indicateTypeNullability = ddtConfig.get("indicateTypeNullability") as boolean;
        settings.objectTypeForGenericParameters = ddtConfig.get("objectTypeForGenericParameters") as boolean;
        settings.packagesForTestServiceProviderSupport = ddtConfig.get("packagesForTestServiceProviderSupport") as string[];
        settings.reservedMethodNames = ddtConfig.get("reservedMethodNames") as string[];
        settings.testClassNamePrefixIfFileAlreadyExists = ddtConfig.get("testClassNamePrefixIfFileAlreadyExists") as string;
        settings.typesNotToBeIndicatedAsNullable = ddtConfig.get("typesNotToBeIndicatedAsNullable") as string[];
        settings.useOnlyNewOperatorForInstanceInstantiation = ddtConfig.get("useOnlyNewOperatorForInstanceInstantiation") as boolean;
        settings.usingsFileContent = ddtConfig.get("usingsFileContent") as string;
        settings.warningsToDisable = ddtConfig.get("warningsToDisable") as string[];
        return settings;
    }

    private createParseSettings(): CSharpParseSettings {
        const ddtConfig = vscode.workspace.getConfiguration(this.configurationSection);

        const settings = new CSharpParseSettings();
        settings.methodNamesToIgnore = ddtConfig.get("methodNamesToIgnore") as string[];

        return settings;
    }

    private async createTestClassesForDocument(document: vscode.TextDocument): Promise<CSharpXunitTestClass[] | undefined> {
        return await VSCodeCSharp.parseTextDocument(this.outputChannel, this.createParseSettings(), document).then(cSharpClasses => {
            const documentRelativePath = vscode.workspace.asRelativePath(document.uri);
            if (!cSharpClasses || cSharpClasses.length === 0) {
                this.outputChannel.appendLine(`${documentRelativePath}: No C# class found.`);
                return;
            }

            const testableClasses = cSharpClasses.filter(c => c.isPublic && !c.isStatic && !c.isAbstract);
            if (testableClasses.length === 0) {
                this.outputChannel.appendLine(`${documentRelativePath}: No testable C# class found.`);
                return;
            }

            const testClasses = testableClasses.map(c => new CSharpXunitTestClass(c)).filter(c => c.testMethods.length > 0);
            if (testClasses.length === 0) {
                this.outputChannel.appendLine(`${documentRelativePath}: No C# class with testable method(s) found.`);
                return;
            }

            return testClasses;
        });
    }

    private async getCSharpProjectFile(quickPickPlaceholder = "Select C# project"): Promise<CSharpProjectFile | undefined> {
        const projects = await CSharpProjectFile.findProjectsAsync(this.workspaceFolder!);

        if (projects.length === 0) {
            this.warning("No C# project found.");
            return;
        }

        if (projects.length === 1) return projects[0];

        const projectSelected = await vscode.window.showQuickPick(projects.map(p => p.relativePath), { placeHolder: quickPickPlaceholder });
        return projectSelected ? projects.find(p => p.relativePath === projectSelected) : undefined;
    }

    private async getCSharpTestProjectFile(): Promise<CSharpProjectFile | undefined> {
        const testProjects = (await CSharpProjectFile.findProjectsAsync(this.workspaceFolder!)).filter(p => p.isTestProject);

        let testProject: CSharpProjectFile | undefined;
        if (testProjects.length === 0) {
            this.outputChannel.appendLine("No C# test project found. If indeed there is a test project, make sure the project file has property `IsTestProject` set to `true`.");
            return;
        }
        else if (testProjects.length === 1) {
            testProject = testProjects[0];
        }
        else {
            const testProjectSelected = await vscode.window.showQuickPick(testProjects.map(p => p.relativePath), { placeHolder: "Select C# test project to create C# Xunit test files in" });
            if (!testProjectSelected) { return; }
            testProject = testProjects.find(p => p.relativePath === testProjectSelected);
            if (!testProject) { return; }
        }

        return testProject;
    }

    private async writeOrAppendToTestFiles(testClasses: CSharpXunitTestClass[], testProject: CSharpProjectFile, openFile = true) {
        const generateSettings = this.createGenerateSettings();

        if (testProject.defaultNamespace) {
            generateSettings.targetProjectNamespace = testProject.defaultNamespace;
        }

        let appendedCount = 0;
        let createdCount = 0;
        let createdUsingsFile = false;

        for await (const testClass of testClasses) {
            const testFilePath = FileSystem.joinPaths(testProject.directory!, testClass.fileName);
            const relativeTestFilePath = vscode.workspace.asRelativePath(testFilePath);

            if (await FileSystem.existsAsync(testFilePath)) {
                testClass.className = generateSettings.testClassNamePrefixIfFileAlreadyExists + testClass.className;
                await FileSystem.appendFile(testFilePath, "\n\n" + testClass.generate(generateSettings, false));

                appendedCount++;
                this.outputChannel.appendLine(`Appended to ${relativeTestFilePath}`);
            }
            else {
                await FileSystem.writeFile(testFilePath, testClass.generate(generateSettings));

                createdCount++;
                this.outputChannel.appendLine(`Created ${relativeTestFilePath}`);
            }

            if (openFile) { await vscode.window.showTextDocument(vscode.Uri.file(testFilePath)); }
        }

        const usingsFilePath = FileSystem.joinPaths(testProject.directory!, CSharpXunitTestGenerateSettings.usingsFileName);
        if (!(await FileSystem.existsAsync(usingsFilePath)) && generateSettings.usingsFileContent) {
            await FileSystem.writeFile(usingsFilePath, generateSettings.usingsFileContent);
            createdUsingsFile = true;
        }

        this.outputChannel.appendLine((createdCount > 0 ? `Created ${createdCount} C# Xunit test file(s). ` : "")
            + (appendedCount > 0 ? `Appended to ${appendedCount} C# Xunit test file(s). ` : "")
            + (createdUsingsFile ? `Created ${CSharpXunitTestGenerateSettings.usingsFileName} file.` : ""));

        if (generateSettings.addTestServiceProviderSupport) await this.addTestServiceProviderSupportToProjectAsync(testProject);
    }
}
