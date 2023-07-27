/**
 * C# Xunit test generation settings
 */
export class CSharpXunitTestGenerateSettings {
    indentation: string = '    ';
    indicateTypeNullability: boolean = true;
    objectTypeForGenericParameters: boolean = true;
    typesNotToBeIndicatedAsNullable: string[] = [];

    public indent(level: number): string {
        return this.indentation.repeat(level);
    }
}
