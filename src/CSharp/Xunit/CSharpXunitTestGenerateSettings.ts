/**
 * C# Xunit test generation settings
 */
export class CSharpXunitTestGenerateSettings {
    indentation: string = "    ";
    indicateTypeNullability: boolean = true;
    objectTypeForGenericParameters: boolean = true;
    reservedMethodNames: string[] = [];
    testClassNamePrefixIfFileAlreadyExists: string = "Ddt";
    typesNotToBeIndicatedAsNullable: string[] = [];
    useOnlyNewOperatorForInstanceInstantiation: boolean = false;
    usingsFileContent: string = "";

    indent(level: number): string {
        return this.indentation.repeat(level);
    }
}
