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
            this.createCreateTestFilesForFileCommand(),
            this.createCreateTestFilesForProjectCommand());

        CSharpNamespace.defaultName = "DevelopmentDrivenTesting";
    }

    static use(context: vscode.ExtensionContext) {
        const extension = new DevelopmentDrivenTestingVSCodeExtension(context);
    }

    private createCopyTestClassesForFileCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.ddt.copy-test-classes-for-file", async () => {
            if (!super.isWorkspaceReady() || !this.isCSharpFileOpen()) { return; }

            const document = vscode.window.activeTextEditor?.document;
            if (!document) { return; }

            const testClasses = await this.createTestClassesForDocument(document);
            if (!testClasses) { return; }

            const generateSettings = this.createGenerateSettings();
            vscode.env.clipboard.writeText(testClasses.map(c => c.generate(generateSettings)).join("\n\n"));

            this.outputChannel.appendLine("Sent test class(es) to clipboard.");
        });
    }

    private createCreateTestFilesForFileCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.ddt.create-test-files-for-file", async () => {
            if (!super.isWorkspaceReady() || !this.isCSharpFileOpen()) { return; }

            const document = vscode.window.activeTextEditor?.document;
            if (!document) { return; }

            const testProject = await this.getTestProject();
            if (!testProject) { return; }

            const testClasses = await this.createTestClassesForDocument(document);
            if (!testClasses) { return; }

            await this.writeOrAppendToTestFiles(testClasses, testProject);
        });
    }

    private createCreateTestFilesForProjectCommand(): VSCodeCommand {
        return new VSCodeCommand("kokoabim.ddt.create-test-files-for-project", async () => {
            if (!super.isWorkspaceReady()) { return; }

            const document = vscode.window.activeTextEditor?.document;
            if (!document) {
                this.outputChannel.appendLine("No active document. Select a file in the project to create test files for.");
                return;
            }

            const cSharpProjects = await CSharpProjectFile.findProjects(this.workspaceFolder!.uri.path);
            if (cSharpProjects.length === 0) {
                this.outputChannel.appendLine("No C# projects found.");
                return;
            }

            const activeProject = cSharpProjects.find(p => document.uri.path.includes(p.directory));
            if (!activeProject) {
                this.outputChannel.appendLine("No C# project found for active document.");
                return;
            }
            else if (activeProject.isTestProject) {
                this.outputChannel.appendLine(`${activeProject.relativePath}: Active document is in a test project. Select a file in a non-test project to create test files for.`);
                return;
            }

            const cSharpFiles = (await vscode.workspace.findFiles("**/*.cs")).filter(f => f.path.includes(activeProject.directory));
            if (cSharpFiles.length === 0) {
                this.outputChannel.appendLine(`${activeProject.relativePath}: No C# files found.`);
                return;
            }

            const testProject = await this.getTestProject();
            if (!testProject) { return; }

            let testClasses: CSharpXunitTestClass[] = [];
            for await (const cSharpFile of cSharpFiles) {
                const testClassesForFile = await this.createTestClassesForDocument(await vscode.workspace.openTextDocument(cSharpFile));
                if (testClassesForFile) { testClasses.push(...testClassesForFile); }
            }

            if (testClasses.length === 0) {
                this.outputChannel.appendLine(`${activeProject.relativePath}: No tests generated.`);
                return;
            }

            await this.writeOrAppendToTestFiles(testClasses, testProject, false);
        });
    }

    private createGenerateSettings(): CSharpXunitTestGenerateSettings {
        const ddtConfig = vscode.workspace.getConfiguration(this.configurationSection);
        const editConfig = vscode.workspace.getConfiguration("editor");

        const generateSettings = new CSharpXunitTestGenerateSettings();
        generateSettings.indentation = editConfig.get("insertSpaces") as boolean ? " ".repeat(editConfig.get("tabSize") as number) : "\t";
        generateSettings.indicateTypeNullability = ddtConfig.get("indicateTypeNullability") as boolean;
        generateSettings.objectTypeForGenericParameters = ddtConfig.get("objectTypeForGenericParameters") as boolean;
        generateSettings.reservedMethodNames = ddtConfig.get("reservedMethodNames") as string[];
        generateSettings.testClassNamePrefixIfFileAlreadyExists = ddtConfig.get("testClassNamePrefixIfFileAlreadyExists") as string;
        generateSettings.typesNotToBeIndicatedAsNullable = ddtConfig.get("typesNotToBeIndicatedAsNullable") as string[];
        generateSettings.useOnlyNewOperatorForInstanceInstantiation = ddtConfig.get("useOnlyNewOperatorForInstanceInstantiation") as boolean;
        generateSettings.usingsFileContent = ddtConfig.get("usingsFileContent") as string;
        return generateSettings;
    }

    private async createTestClassesForDocument(document: vscode.TextDocument): Promise<CSharpXunitTestClass[] | undefined> {
        return await VSCodeCSharp.parseTextDocument(this.outputChannel, document).then(cSharpClasses => {
            if (!cSharpClasses || cSharpClasses.length === 0) {
                this.outputChannel.appendLine(`${document.uri.path}: No C# class found.`);
                return;
            }

            const testableClasses = cSharpClasses.filter(c => c.isPublic && !c.isStatic && !c.isAbstract);
            if (testableClasses.length === 0) {
                this.outputChannel.appendLine(`${document.uri.path}: No testable class found.`);
                return;
            }

            const testClasses = testableClasses.map(c => new CSharpXunitTestClass(c)).filter(c => c.testMethods.length > 0);
            if (testClasses.length === 0) {
                this.outputChannel.appendLine(`${document.uri.path}: No class with testable method found.`);
                return;
            }

            return testClasses;
        });
    }

    /*private async createTestClassesForDocument2(document: vscode.TextDocument): Promise<CSharpXunitTestClass[] | undefined> {
        return await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", document.uri).then(ds => {
            const documentRelativePath = vscode.workspace.asRelativePath(document.uri);
            const documentSymbols = ds as vscode.DocumentSymbol[];
            if (!ds || !documentSymbols || documentSymbols.length === 0) {
                this.outputChannel.appendLine(`${documentRelativePath}: No C# symbols found.`);
                return;
            }

            const cSharpSymbols = CSharpSymbol2.createCSharpSymbols(documentSymbols, document);
            if (!cSharpSymbols || cSharpSymbols.length === 0) {
                this.outputChannel.appendLine(`${documentRelativePath}: No C# symbols found.`);
                return;
            }

            const classesToCreateTestClassesFor: CSharpSymbol2[] = [];
            for (const cSharpSymbol of cSharpSymbols) {
                if (cSharpSymbol instanceof CSharpNamespace2) {
                    classesToCreateTestClassesFor.push(...cSharpSymbol.classes.filter(c => c.isPublic && !c.isStatic && !c.isAbstract));
                }
                else if (cSharpSymbol instanceof CSharpSymbol2 && cSharpSymbol.symbolType === CSharpSymbolType.class && cSharpSymbol.isPublic && !cSharpSymbol.isStatic && !cSharpSymbol.isAbstract) {
                    classesToCreateTestClassesFor.push(cSharpSymbol);
                }
            }
            if (classesToCreateTestClassesFor.length === 0) {
                this.outputChannel.appendLine(`${documentRelativePath}: No testable class found.`);
                return;
            }

            return classesToCreateTestClassesFor.map(c => new CSharpXunitTestClass(c)).filter(c => c.testMethods.length > 0);

            /*const namespaces = documentSymbols.filter(ds => ds.kind === vscode.SymbolKind.Namespace).map(ds => new CSharpNamespaceInfo(ds, document!));
            if (namespaces.length === 0) {
                this.outputChannel.appendLine(`${documentRelativePath}: No namespace found.`);
                return;
            }
            else if (namespaces.length > 1) {
                this.outputChannel.appendLine(`${documentRelativePath}: Multiple namespaces found. This is currently not supported.`);
                return;
            }

            const testClasses = namespaces[0].classes.filter(c => c.isPublic && !c.isStatic && !c.isAbstract).map(c => new CSharpXunitTestClass(c)).filter(c => c.testMethods.length > 0);
            if (testClasses.length === 0) {
                this.outputChannel.appendLine(`${documentRelativePath}: No testable class found.`);
                return;
            }

            this.outputChannel.appendLine(`${documentRelativePath}: ${testClasses.length} testable class(es) found.`);

            return testClasses;* /
        });
    }*/

    private async getTestProject(): Promise<CSharpProjectFile | undefined> {
        const testProjects = (await CSharpProjectFile.findProjects(this.workspaceFolder!.uri.path)).filter(p => p.isTestProject);

        let testProject: CSharpProjectFile | undefined;
        if (testProjects.length === 0) {
            this.outputChannel.appendLine("No C# test project found. If indeed there is a test project, make sure the project file has property IsTestProject set to true.");
            return;
        }
        else if (testProjects.length === 1) {
            testProject = testProjects[0];
        }
        else {
            const testProjectSelected = await vscode.window.showQuickPick(testProjects.map(p => p.relativePath), { placeHolder: "Select test project" });
            if (!testProjectSelected) { return; }
            testProject = testProjects.find(p => p.relativePath === testProjectSelected);
            if (!testProject) { return; }
        }

        return testProject;
    }

    private isCSharpFileOpen(): boolean {
        const doc = vscode.window.activeTextEditor?.document;
        if (doc?.languageId !== "csharp") {
            this.outputChannel.appendLine(`A C# file must be open to use ${this.extensionName}.`);
            return false;
        }
        return true;
    }

    private async writeOrAppendToTestFiles(testClasses: CSharpXunitTestClass[], testProject: CSharpProjectFile, openFile: boolean = true) {
        const generateSettings = this.createGenerateSettings();

        let appendedCount = 0;
        let createdCount = 0;
        let createdUsingsFile = false;

        for await (const testClass of testClasses) {
            const testFilePath = this.fileSystem.joinPaths(testProject.directory, testClass.fileName);
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

        const usingsFilePath = this.fileSystem.joinPaths(testProject.directory, CSharpXunitTestClass.usingsFileName);
        if (!(await this.fileSystem.exists(usingsFilePath)) && generateSettings.usingsFileContent) {
            await this.fileSystem.writeFile(usingsFilePath, generateSettings.usingsFileContent);
            createdUsingsFile = true;
        }

        this.outputChannel.appendLine((createdCount > 0 ? `Created ${createdCount} test file(s). ` : "")
            + (appendedCount > 0 ? `Appended to ${appendedCount} test file(s). ` : "")
            + (createdUsingsFile ? `Created ${CSharpXunitTestClass.usingsFileName} file.` : ""));
    }
}