import { CSharpXunitTestGenerateSettings } from "./CSharpXunitTestGenerateSettings";
import { CSharpXunitTestMethod } from "./CSharpXunitTestMethod";
import { FileSystem } from '../../Utils/FileSystem';
import { CSharpClass } from "../VSCodeCSharp";
import "../../Extensions/Array.extensions";
import { StringBuilder } from "../../Utils/StringBuilder";

/**
 * C# Xunit test class
 */
export class CSharpXunitTestClass {
    static readonly usingsFileName = "Usings.cs";

    className: string;
    fileName: string;
    testMethods: CSharpXunitTestMethod[] = [];

    private _cSharpClass: CSharpClass;

    constructor(cSharpClass: CSharpClass) {
        this._cSharpClass = cSharpClass;

        this.className = cSharpClass.name + "Tests";
        this.fileName = this.className + ".cs";

        const testableMethods = cSharpClass.methods.filter(m => m.isPublic && !m.isStatic && !m.isAbstract);
        testableMethods.groupBy("name").forEach((methods, name) => {
            if (methods.length === 1) {
                this.testMethods.push(new CSharpXunitTestMethod(cSharpClass, methods[0]));
            }
            else {
                this.testMethods.push(...methods.map((m, i) => new CSharpXunitTestMethod(cSharpClass, m, m.name + (i + 1))));
            }
        });
    };

    /**
     * Generates test class with test methods
     */
    generate(settings: CSharpXunitTestGenerateSettings, withUsingsAndNamespace: boolean = true): string {
        const namespace = (this._cSharpClass.namespace || settings.defaultNamespace) + ".Tests";

        const sb = new StringBuilder();

        if (withUsingsAndNamespace) {
            if (this._cSharpClass.usings.length > 0) {
                sb.append(this._cSharpClass.usings.map(u => `using ${u};`).join("\n") + "\n\n");
            }

            sb.append(`namespace ${namespace};\n\n`);
        }

        if (settings.disableCompilerWarnings) {
            sb.append("#nullable disable\n");

            if (settings.warningsToDisable.length > 0) {
                sb.append("#pragma warning disable " + settings.warningsToDisable.join(", ") + "\n");
            }
        }

        sb.append(`public class ${this.className}\n{\n`);

        sb.append(`${this.testMethods.map(m => m.generate(settings)).join("\n\n")}\n}`);

        if (settings.disableCompilerWarnings) {
            if (settings.warningsToDisable.length > 0) {
                sb.append("\n#pragma warning restore " + settings.warningsToDisable.join(", "));
            }

            sb.append("\n#nullable restore");
        }

        return sb.toString();
    }
}
