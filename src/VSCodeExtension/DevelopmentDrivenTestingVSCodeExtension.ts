import * as vscode from "vscode";
import { CSharpProjectFile } from "../CSharp/ProjectFile/CSharpProjectFile";
import { CSharpXunitTestClass } from "../CSharp/Xunit/CSharpXunitTestClass";
import { CSharpXunitTestGenerateSettings } from "../CSharp/Xunit/CSharpXunitTestGenerateSettings";
import { VSCodeCommand } from "./VSCodeCommand";
import { VSCodeExtension } from "./VSCodeExtension";
import { CSharpNamespace, VSCodeCSharp } from "../CSharp/VSCodeCSharp";

/**
 * Development-Driven Testing (DDT) VSCode extension
 */
export class DevelopmentDrivenTestingVSCodeExtension extends VSCodeExtension {

    private constructor(context: vscode.ExtensionContext) {
        super(context, "ddt");

        this.addCommands(
            this.createCopyTestClassesForFileCommand(),
            this.createCreateTestFileForFileCommand(),
            this.createCreateTestFilesForProjectCommand());

        CSharpNamespace.defaultName = "DevelopmentDrivenTesting";
    }

    static use(context: vscode.ExtensionContext) {
        new DevelopmentDrivenTestingVSCodeExtension(context);
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

            const [document, documentRelativePath] = await this.cSharpFileOrProjectOpenOrSelected();
            if (!document) { return; }

            const cSharpProjectFiles = await CSharpProjectFile.findProjects(this.workspaceFolder!.uri.path);
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

        const generateSettings = new CSharpXunitTestGenerateSettings();
        generateSettings.defaultNamespace = ddtConfig.get("defaultNamespace") as string;
        generateSettings.disableCompilerWarnings = ddtConfig.get("disableCompilerWarnings") as boolean;
        generateSettings.doNothingRegardingNullability = ddtConfig.get("doNothingRegardingNullability") as boolean;
        generateSettings.indentation = editConfig.get("insertSpaces") as boolean ? " ".repeat(editConfig.get("tabSize") as number) : "\t";
        generateSettings.indicateTypeNullability = ddtConfig.get("indicateTypeNullability") as boolean;
        generateSettings.objectTypeForGenericParameters = ddtConfig.get("objectTypeForGenericParameters") as boolean;
        generateSettings.reservedMethodNames = ddtConfig.get("reservedMethodNames") as string[];
        generateSettings.testClassNamePrefixIfFileAlreadyExists = ddtConfig.get("testClassNamePrefixIfFileAlreadyExists") as string;
        generateSettings.typesNotToBeIndicatedAsNullable = ddtConfig.get("typesNotToBeIndicatedAsNullable") as string[];
        generateSettings.useOnlyNewOperatorForInstanceInstantiation = ddtConfig.get("useOnlyNewOperatorForInstanceInstantiation") as boolean;
        generateSettings.usingsFileContent = ddtConfig.get("usingsFileContent") as string;
        generateSettings.warningsToDisable = ddtConfig.get("warningsToDisable") as string[];
        return generateSettings;
    }

    private async createTestClassesForDocument(document: vscode.TextDocument): Promise<CSharpXunitTestClass[] | undefined> {
        return await VSCodeCSharp.parseTextDocument(this.outputChannel, document).then(cSharpClasses => {
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
        catch (e) { }

        if (!document) {
            this.outputChannel.appendLine("No C# file or project is open or selected.");
            return [undefined, undefined];
        }
        const relativePath = vscode.workspace.asRelativePath(document.uri);
        return [document, relativePath];
    }


    private async getCSharpTestProjectFile(): Promise<CSharpProjectFile | undefined> {
        const testProjects = (await CSharpProjectFile.findProjects(this.workspaceFolder!.uri.path)).filter(p => p.isTestProject);

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

    private async writeOrAppendToTestFiles(testClasses: CSharpXunitTestClass[], testProject: CSharpProjectFile, openFile: boolean = true) {
        const generateSettings = this.createGenerateSettings();

        if (testProject.defaultNamespace) {
            generateSettings.targetProjectNamespace = testProject.defaultNamespace;
        }

        let appendedCount = 0;
        let createdCount = 0;
        let createdUsingsFile = false;

        for await (const testClass of testClasses) {
            const testFilePath = this.fileSystem.joinPaths(testProject.directory!, testClass.fileName);
            const relativeTestFilePath = vscode.workspace.asRelativePath(testFilePath);

            if (await this.fileSystem.exists(testFilePath)) {
                testClass.className = generateSettings.testClassNamePrefixIfFileAlreadyExists + testClass.className;
                await this.fileSystem.appendFile(testFilePath, "\n\n" + testClass.generate(generateSettings, false));

                appendedCount++;
                this.outputChannel.appendLine(`Appended to ${relativeTestFilePath}`);
            }
            else {
                await this.fileSystem.writeFile(testFilePath, testClass.generate(generateSettings));

                createdCount++;
                this.outputChannel.appendLine(`Created ${relativeTestFilePath}`);
            }

            if (openFile) { await vscode.window.showTextDocument(vscode.Uri.file(testFilePath)); }
        }

        const usingsFilePath = this.fileSystem.joinPaths(testProject.directory!, CSharpXunitTestClass.usingsFileName);
        if (!(await this.fileSystem.exists(usingsFilePath)) && generateSettings.usingsFileContent) {
            await this.fileSystem.writeFile(usingsFilePath, generateSettings.usingsFileContent);
            createdUsingsFile = true;
        }

        this.outputChannel.appendLine((createdCount > 0 ? `Created ${createdCount} C# Xunit test file(s). ` : "")
            + (appendedCount > 0 ? `Appended to ${appendedCount} C# Xunit test file(s). ` : "")
            + (createdUsingsFile ? `Created ${CSharpXunitTestClass.usingsFileName} file.` : ""));
    }
}