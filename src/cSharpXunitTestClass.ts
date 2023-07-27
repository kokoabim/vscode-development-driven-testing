import { CSharpClassInfo } from './cSharpClassInfo';
import { CSharpXunitTestGenerateSettings } from './cSharpXunitTestGenerateSettings';
import { CSharpXunitTestMethod } from './cSharpXunitTestMethod';

/**
 * C# Xunit test class
 */
export class CSharpXunitTestClass {
    /**
     * Test methods for class methods
    */
    methodTests: CSharpXunitTestMethod[];

    private _classInfo: CSharpClassInfo;

    constructor(classInfo: CSharpClassInfo) {
        this._classInfo = classInfo;
        this.methodTests = classInfo.methods.filter(m => m.isPublic() && !m.isStatic()).map(m => new CSharpXunitTestMethod(classInfo, m));
    };

    /**
     * Generates test class with test methods
     */
    public generate(settings: CSharpXunitTestGenerateSettings): string {
        return `namespace ${this._classInfo.namespace}.Tests;\n\npublic class ${this._classInfo.symbolName}Tests\n{\n${this.methodTests.map(m => m.generate(settings)).join('\n\n')}\n}`;
    }
}
