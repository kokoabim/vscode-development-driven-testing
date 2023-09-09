import { CSharpXunitTestGenerateSettings } from "./CSharpXunitTestGenerateSettings";
import { CSharpXunitTestMethod } from "./CSharpXunitTestMethod";
import { FileSystem } from '../../Utils/FileSystem';
import { CSharpClass } from "../VSCodeCSharp";

/**
 * C# Xunit test class
 */
export class CSharpXunitTestClass {
    static readonly usingsFileName = "Usings.cs";

    className: string;
    fileName: string;
    namespace: string;
    testMethods: CSharpXunitTestMethod[];
    usings: string[] = [];

    constructor(cSharpClass: CSharpClass) {
        this.className = cSharpClass.name + "Tests";
        this.fileName = this.className + ".cs";
        this.namespace = cSharpClass.namespace + ".Tests";
        this.testMethods = cSharpClass.methods.filter(m => m.isPublic && !m.isStatic && !m.isAbstract).map(m => new CSharpXunitTestMethod(cSharpClass, m));
        this.usings = cSharpClass.usings;
    };

    /**
     * Generates test class with test methods
     */
    generate(settings: CSharpXunitTestGenerateSettings, withUsingsAndNamespace: boolean = true): string {
        return `${withUsingsAndNamespace && this.usings.length > 0 ? `${this.usings.map(u => `using ${u};`).join("\n")}\n\n` : ""}${withUsingsAndNamespace ? `namespace ${this.namespace};\n\n` : ""}${settings.indicateTypeNullability ? "" : '#nullable disable\n'}${settings.warningsToDisable.length > 0 ? "#pragma warning disable " + settings.warningsToDisable.join(", ") + "\n" : ""}public class ${this.className}\n{\n${this.testMethods.map(m => m.generate(settings)).join("\n\n")}\n}${settings.warningsToDisable.length > 0 ? "\n#pragma warning restore " + settings.warningsToDisable.join(", ") : ""}${settings.indicateTypeNullability ? "" : '\n#nullable restore'}`;
    }

    static async createUsingsFile(filePath: string): Promise<void> {
        const fileSystem = new FileSystem();
        await fileSystem.writeFile(filePath, "global using Xunit;");
    }
}
