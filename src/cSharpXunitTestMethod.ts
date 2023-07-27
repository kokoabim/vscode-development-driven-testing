import { CSharpSymbolGenericInfo } from './CSharpSymbolGenericInfo';
import { CSharpTypeInfo } from './CSharpTypeInfo';
import { CSharpClassInfo } from './cSharpClassInfo';
import { CSharpConstructorInfo } from './cSharpConstructorInfo';
import { CSharpMethodInfo } from './cSharpMethodInfo';
import { CSharpXunitTestGenerateSettings } from './cSharpXunitTestGenerateSettings';

/**
 * C# Xunit test method
 */
export class CSharpXunitTestMethod {
    private _classInfo: CSharpClassInfo;
    private _generics: CSharpSymbolGenericInfo[] = [];
    private _methodInfo: CSharpMethodInfo;

    constructor(classInfo: CSharpClassInfo, methodInfo: CSharpMethodInfo) {
        this._classInfo = classInfo;
        this._methodInfo = methodInfo;

        if (this._classInfo.symbolGenerics) { this._generics.push(...this._classInfo.symbolGenerics); }
        if (this._methodInfo.symbolGenerics) { this._generics.push(...this._methodInfo.symbolGenerics); }
    };

    /**
     * Generates test method
     */
    public generate(settings: CSharpXunitTestGenerateSettings): string {
        const awaitTargetMethod = this._methodInfo.returnType!.base === 'Task' ? 'await ' : '';
        const classSymbolType = this.getClassSymbolType(settings);
        const methodReturnType = this.getMethodReturnType(settings);
        const methodHasVoidReturn = methodReturnType === 'void';
        const targetConstructorInfo = this.getConstructorWithLongestSignature(this._classInfo.constructors);
        const testMethodReturnType = this._methodInfo.returnType!.base === 'Task' ? 'async Task' : 'void';

        const expectedValueLine = !methodHasVoidReturn ? settings.indent(2) + `${methodReturnType} expected = default;\n\n` : '';
        const methodArgumentsLines = this._methodInfo.parameters.length > 0 ? this._methodInfo.parameters.map(p => settings.indent(2) + `${this.getTypeName(p.typeInfo!, settings)} method_${p.name} = default;`).join('\n') + '\n\n' : '';
        const targetArgumentsLines = targetConstructorInfo.parameters.length > 0 ? targetConstructorInfo.parameters.map(p => settings.indent(2) + `${this.getTypeName(p.typeInfo!, settings)} target_${p.name} = default;`).join('\n') + '\n\n' : '';
        const createTargetLine = `${classSymbolType} target = new ${classSymbolType}(${targetConstructorInfo.parameters.map(p => `${p.isOut ? 'out ' : ''}${p.isRef ? 'ref ' : ''}target_${p.name}`).join(', ')});`;
        const callTargetMethodLine = `${(methodHasVoidReturn ? '' : `${methodReturnType} actual = `)}${awaitTargetMethod}target.${this.getMethodSymbolType(settings)}(${this._methodInfo.parameters.map(p => `${p.isOut ? 'out ' : ''}${p.isRef ? 'ref ' : ''}method_${p.name}`).join(', ')});`;
        const assertExpectedVsActualLine = !methodHasVoidReturn ? settings.indent(1) + `Assert.Equal(expected, actual);\n` + settings.indent(1) : '';

        return settings.indent(1) + `[Fact]\n`
            + settings.indent(1) + `public ${testMethodReturnType} ${this._methodInfo.symbolName}()\n`
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
        return typeName + (settings.indicateTypeNullability && settings.typesNotToBeIndicatedAsNullable.indexOf(typeName) === -1 && !typeName.endsWith('?') ? '?' : '');
    }

    private getClassSymbolType(settings: CSharpXunitTestGenerateSettings): string {
        return this._classInfo.symbolGenerics
            ? `${this._classInfo.symbolName}<${this.getGenericOrObjectThenApplyNullability(this._classInfo.symbolGenerics, settings).join(', ')}>`
            : this._classInfo.symbolName;
    }

    private getConstructorWithLongestSignature(constructors: CSharpConstructorInfo[]): CSharpConstructorInfo {
        return constructors.reduce((a, b) => a.signature.length > b.signature.length ? a : b);
    }

    private getGenericOrObject(generics: CSharpSymbolGenericInfo[], settings: CSharpXunitTestGenerateSettings): string[] {
        return generics.map(g => (settings.objectTypeForGenericParameters ? 'object' : g.fullName) + (g.isArray ? '[]' : ''));
    }

    private getGenericOrObjectThenApplyNullability(generics: CSharpSymbolGenericInfo[], settings: CSharpXunitTestGenerateSettings): string[] {
        return this.getGenericOrObject(generics, settings); //.map(g => this.applyNullability(g, settings));
    }

    private getMethodReturnType(settings: CSharpXunitTestGenerateSettings): string {
        const typeInfo = this._methodInfo.returnType!.base === 'Task' ? this._methodInfo.returnType!.genericType : this._methodInfo.returnType;
        return typeInfo ? this.getTypeName(typeInfo, settings) : 'void';
    }

    private getMethodSymbolType(settings: CSharpXunitTestGenerateSettings): string {
        return this._methodInfo.symbolGenerics
            ? `${this._methodInfo.symbolName}<${this.getGenericOrObjectThenApplyNullability(this._methodInfo.symbolGenerics, settings).join(', ')}>`
            : this._methodInfo.symbolName;
    }

    private getTypeName(typeInfo: CSharpTypeInfo, settings: CSharpXunitTestGenerateSettings, doNotApplyNullability: boolean = false): string {
        let typeName = typeInfo.base;

        if (this._generics.map(g => g.base).indexOf(typeInfo.base) !== -1 && settings.objectTypeForGenericParameters) {
            typeName = 'object';
        }

        if (typeInfo.genericType) { typeName += `<${this.getTypeName(typeInfo.genericType, settings, true)}>`; }

        if (typeInfo.isArray) { typeName += '[]'; }

        if (typeInfo.isNullable) { typeName += '?'; }
        else if (!doNotApplyNullability) { typeName = this.applyNullability(typeName, settings); }

        return typeName;
    }
}
