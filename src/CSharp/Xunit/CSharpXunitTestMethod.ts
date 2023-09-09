import { CSharpClass, CSharpConstructor, CSharpMethod, CSharpParameter, CSharpType } from '../VSCodeCSharp';
import { CSharpXunitTestGenerateSettings } from "./CSharpXunitTestGenerateSettings";

/**
 * C# Xunit test method
 */
export class CSharpXunitTestMethod {
    private _cSharpClass: CSharpClass;
    private _cSharpMethod: CSharpMethod;
    private _genericParameters: string[] = [];
    private _testMethodNameOverride?: string;

    private _genericParameterExpression: RegExp = /^T(\d+|[A-Z]*?[a-z0-9_]*?)$/; // ex: T1, TKey, TValue1

    constructor(classSymbol: CSharpClass, methodSymbol: CSharpMethod, testMethodNameOverride?: string) {
        this._cSharpClass = classSymbol;
        this._cSharpMethod = methodSymbol;
        this._testMethodNameOverride = testMethodNameOverride;

        if (this._cSharpClass.hasGenerics) { this.getGenericParameters(this._cSharpClass.generics); }
        if (this._cSharpMethod.hasGenerics) { this.getGenericParameters(this._cSharpMethod.generics); }
    };

    generate(settings: CSharpXunitTestGenerateSettings): string {
        const testableConstructors = this._cSharpClass.constructors.filter(c => c.isPublic && !c.isStatic && !c.isAbstract);
        const targetConstructor = testableConstructors.length > 0
            ? CSharpXunitTestMethod.getConstructorWithMostParameters(testableConstructors)
            : CSharpConstructor.createDefault(this._cSharpClass.name);

        // object for Ts
        if (settings.objectTypeForGenericParameters) {
            this.replaceGenericParametersWithObject(this._cSharpClass.generics);
            if (targetConstructor.hasParameters) { this.replaceGenericParametersWithObject(targetConstructor.parameters.map(p => p.type)); }

            this.replaceGenericParametersWithObject(this._cSharpMethod.generics);
            this.replaceGenericParametersWithObject([this._cSharpMethod.returnType]);
            if (this._cSharpMethod.hasParameters) { this.replaceGenericParametersWithObject(this._cSharpMethod.parameters.map(p => p.type)); }
        }

        // nullability
        if (!settings.doNothingRegardingNullability) {
            if (!settings.indicateTypeNullability) {
                const typesNotToRemoveNullability = settings.typesNotToBeIndicatedAsNullable.filter(t => t !== "string" && t !== "System.String" && t !== "String"); // workaround to prevent VS Code warnings

                this.removeTypeNullability(this._cSharpClass.generics, typesNotToRemoveNullability);
                if (targetConstructor.hasParameters) { this.removeTypeNullability(targetConstructor.parameters.map(p => p.type), typesNotToRemoveNullability); }

                this.removeTypeNullability(this._cSharpMethod.generics, typesNotToRemoveNullability);
                this.removeTypeNullability([this._cSharpMethod.returnType], typesNotToRemoveNullability);
                if (this._cSharpMethod.hasParameters) { this.removeTypeNullability(this._cSharpMethod.parameters.map(p => p.type), typesNotToRemoveNullability); }
            }
            else {
                this.applyTypeNullability(this._cSharpClass.generics, settings.typesNotToBeIndicatedAsNullable);
                if (targetConstructor.hasParameters) { this.applyTypeNullability(targetConstructor.parameters.map(p => p.type), settings.typesNotToBeIndicatedAsNullable); }

                this.applyTypeNullability(this._cSharpMethod.generics, settings.typesNotToBeIndicatedAsNullable);
                this.applyTypeNullability([this._cSharpMethod.returnType], settings.typesNotToBeIndicatedAsNullable);
                if (this._cSharpMethod.hasParameters) { this.applyTypeNullability(this._cSharpMethod.parameters.map(p => p.type), settings.typesNotToBeIndicatedAsNullable); }
            }
        }

        const testMethodNewModifier = !this._testMethodNameOverride && settings.reservedMethodNames.indexOf(this._cSharpMethod.name) !== -1 ? "new " : "";

        let testMethodReturnTypeName, targetMethodAwaitKeyword, methodReturnTypeName;
        if (this._cSharpMethod.returnType.name === "Task") {
            testMethodReturnTypeName = "async Task";
            targetMethodAwaitKeyword = "await ";
            methodReturnTypeName = this._cSharpMethod.returnType.hasGenerics ? this._cSharpMethod.returnType.generics.map(g => g.toString()).join(", ") : "void";
        }
        else {
            testMethodReturnTypeName = "void";
            targetMethodAwaitKeyword = "";
            methodReturnTypeName = this._cSharpMethod.returnType.toString();
        }
        const methodHasVoidReturn = methodReturnTypeName === "void";

        const setExpectedValueLine = methodHasVoidReturn ? "" : settings.indent(2) + `${methodReturnTypeName} expected = default;\n\n`;
        const setMethodArgumentsLines = CSharpXunitTestMethod.generateArgumentsLines("method", this._cSharpMethod.parameters, settings.indent(2));
        const setTargetConstructorArgumentsLines = CSharpXunitTestMethod.generateArgumentsLines("target", targetConstructor.parameters, settings.indent(2));

        const instantiateTarget = `${this._cSharpClass.toString()} target = new${settings.useOnlyNewOperatorForInstanceInstantiation ? "" : " " + this._cSharpClass.toString()}(${targetConstructor.parameters.map(p => `${p.outOrRef()}target_${p.name}`).join(", ")});`;
        const invokeTargetMethod = `${methodHasVoidReturn ? "" : `${methodReturnTypeName} actual = `}${targetMethodAwaitKeyword}target.${this._cSharpMethod.toString()}(${this._cSharpMethod.parameters.map(p => `${p.outOrRef()}method_${p.name}`).join(", ")});`;

        const assertExpectedVsActualLine = methodHasVoidReturn ? "" : settings.indent(1) + `Assert.Equal(expected, actual);\n` + settings.indent(1);

        return settings.indent(1) + `[Fact]\n`
            + settings.indent(1) + `public ${testMethodNewModifier}${testMethodReturnTypeName} ${this._testMethodNameOverride || this._cSharpMethod.name}()\n`
            + settings.indent(1) + `{\n`
            + settings.indent(2) + `// arrange\n`
            + `${setExpectedValueLine}`
            + `${setMethodArgumentsLines}`
            + `${setTargetConstructorArgumentsLines}`
            + settings.indent(2) + `${instantiateTarget}\n\n`
            + settings.indent(2) + `// act\n`
            + settings.indent(2) + `${invokeTargetMethod}\n\n`
            + settings.indent(2) + `// assert\n`
            + settings.indent(1) + `${assertExpectedVsActualLine}}`;
    }

    private getGenericParameters(genericTypes: CSharpType[]) {
        genericTypes.forEach(g => {
            if (g.hasGenerics) {
                this.getGenericParameters(g.generics);
            }
            else if (this._genericParameterExpression.test(g.name)) {
                this._genericParameters.push(g.name);
            }
        });
    }

    private applyTypeNullability(types: CSharpType[], typesNotToBeIndicatedAsNullable: string[]) {
        types.forEach(t => {
            if (!t.isNullable && !typesNotToBeIndicatedAsNullable.includes(t.name)) { t.isNullable = true; }
            if (t.isArray) { t.array.forEach(a => { if (!a.isNullable) { a.isNullable = true; } }); }
            if (t.hasGenerics) { this.replaceGenericParametersWithObject(t.generics); }
        });
    }

    private removeTypeNullability(types: CSharpType[], typesNotToRemoveNullability: string[] = []) {
        types.forEach(t => {
            if (t.isNullable && !typesNotToRemoveNullability.includes(t.name)) { t.isNullable = false; }
            if (t.isArray) { t.array.forEach(a => { if (a.isNullable) { a.isNullable = false; } }); }
            if (t.hasGenerics) { this.replaceGenericParametersWithObject(t.generics); }
        });
    }

    private replaceGenericParametersWithObject(types: CSharpType[]) {
        types.forEach(t => {
            if (this._genericParameters.includes(t.name)) { t.name = "object"; }
            if (t.hasGenerics) { this.replaceGenericParametersWithObject(t.generics); }
        });
    }

    private static generateArgumentsLines(forTargetOrMethod: string, parameters: CSharpParameter[], indention: string): string {
        return parameters.length > 0 ? parameters.map(p => indention + `${p.type.toString()} ${forTargetOrMethod}_${p.name}${p.isOut ? "" : " = default"};`).join("\n") + "\n\n" : "";
    }

    private static getConstructorWithMostParameters(constructors: CSharpConstructor[]): CSharpConstructor {
        return constructors.reduce((a, b) => a.parameters.length > b.parameters.length ? a : b);
    }

    /**
     * Generates test method
     * /
    generate(settings: CSharpXunitTestGenerateSettings): string {
        const awaitTargetMethod = this._methodInfo.type!.base === "Task" ? "await " : "";
        const classSymbolType = this.getClassSymbolType(settings);
        const methodReturnType = this.getMethodReturnType(settings);
        const methodHasVoidReturn = methodReturnType === "void";
        const methodNewModifier = settings.reservedMethodNames.indexOf(this._methodInfo.name) !== -1 ? "new " : "";
        const targetConstructorInfo = this.getConstructorWithLongestSignature(this._classInfo.constructors);
        const testMethodReturnType = this._methodInfo.type!.base === "Task" ? "async Task" : "void";

        const expectedValueLine = !methodHasVoidReturn ? settings.indent(2) + `${methodReturnType} expected = default;\n\n` : "";
        const methodArgumentsLines = this._methodInfo.parameters.length > 0 ? this._methodInfo.parameters.map(p => settings.indent(2) + `${this.getTypeName(p.typeInfo!, settings)} method_${p.name} = default;`).join("\n") + "\n\n" : "";
        const targetArgumentsLines = targetConstructorInfo.parameters.length > 0 ? targetConstructorInfo.parameters.map(p => settings.indent(2) + `${this.getTypeName(p.typeInfo!, settings)} target_${p.name} = default;`).join("\n") + "\n\n" : "";
        const createTargetLine = `${classSymbolType} target = new ${classSymbolType}(${targetConstructorInfo.parameters.map(p => `${p.isOut ? "out " : ""}${p.isRef ? "ref " : ""}target_${p.name}`).join(", ")});`;
        const callTargetMethodLine = `${(methodHasVoidReturn ? "" : `${methodReturnType} actual = `)}${awaitTargetMethod}target.${this.getMethodSymbolType(settings)}(${this._methodInfo.parameters.map(p => `${p.isOut ? "out " : ""}${p.isRef ? "ref " : ""}method_${p.name}`).join(", ")});`;
        const assertExpectedVsActualLine = !methodHasVoidReturn ? settings.indent(1) + `Assert.Equal(expected, actual);\n` + settings.indent(1) : "";

        return settings.indent(1) + `[Fact]\n`
            + settings.indent(1) + `public ${methodNewModifier}${testMethodReturnType} ${this._methodInfo.name}()\n`
            + settings.indent(1) + `{\n`
            + settings.indent(2) + `// arrange\n`
            + `${expectedValueLine}${methodArgumentsLines}${targetArgumentsLines}`
            + settings.indent(2) + `${createTargetLine}\n\n`
            + settings.indent(2) + `// act\n`
            + settings.indent(2) + `${callTargetMethodLine}\n\n`
            + settings.indent(2) + `// assert\n`
            + settings.indent(1) + `${assertExpectedVsActualLine}}`;
    }

    private applyNullability(typeName: string, settings: CSharpXunitTestGenerateSettings): string {
        return typeName + (settings.indicateTypeNullability && settings.typesNotToBeIndicatedAsNullable.indexOf(typeName) === -1 && !typeName.endsWith("?") ? "?" : "");
    }

    private getClassSymbolType(settings: CSharpXunitTestGenerateSettings): string {
        return this._classInfo.generics
            ? `${this._classInfo.name}<${this.getGenericOrObjectThenApplyNullability(this._classInfo.generics, settings).join(", ")}>`
            : this._classInfo.name;
    }

    private getConstructorWithLongestSignature(constructors: CSharpConstructorInfo[]): CSharpConstructorInfo {
        return constructors.reduce((a, b) => a.signature.length > b.signature.length ? a : b);
    }

    private getGenericOrObject(generics: CSharpSymbolGenericInfo[], settings: CSharpXunitTestGenerateSettings): string[] {
        return generics.map(g => (settings.objectTypeForGenericParameters ? "object" : g.fullName) + (g.isArray ? "[]" : ""));
    }

    private getGenericOrObjectThenApplyNullability(generics: CSharpSymbolGenericInfo[], settings: CSharpXunitTestGenerateSettings): string[] {
        return this.getGenericOrObject(generics, settings); //.map(g => this.applyNullability(g, settings));
    }

    private getMethodReturnType(settings: CSharpXunitTestGenerateSettings): string {
        if (this._methodInfo.type!.base === "Task" &&  this._methodInfo.type!.hasGenerics) {
            return this._methodInfo.type!.genericTypes.map(g => this.getTypeName(g, settings, true)).join(", ");
        }
        else {
            return "void";
        }
    }

    private getMethodSymbolType(settings: CSharpXunitTestGenerateSettings): string {
        return this._methodInfo.generics
            ? `${this._methodInfo.name}<${this.getGenericOrObjectThenApplyNullability(this._methodInfo.generics, settings).join(", ")}>`
            : this._methodInfo.name;
    }

    private getTypeName(typeInfo: CSharpTypeInfo, settings: CSharpXunitTestGenerateSettings, doNotApplyNullability: boolean = false): string {
        let typeName = typeInfo.base;

        if (this._generics.map(g => g.base).indexOf(typeInfo.base) !== -1 && settings.objectTypeForGenericParameters) {
            typeName = "object";
        }

        if (typeInfo.hasGenerics) {
            typeName += `<${typeInfo.genericTypes.map(g => this.getTypeName(g, settings, true)).join(", ")}>`;
        }
        else if (typeInfo.isTuple) {
            typeName = `(${typeInfo.tupleTypes.map(t => this.getTypeName(t, settings, true)).join(", ")})`;
        }

        if (typeInfo.isArray) { typeName += "[]"; }

        if (typeInfo.isNullable) { typeName += "?"; }
        else if (!doNotApplyNullability) { typeName = this.applyNullability(typeName, settings); }

        if (typeInfo.variableName) { typeName += ` ${typeInfo.variableName}`; }

        return typeName;
    }
    */
}
