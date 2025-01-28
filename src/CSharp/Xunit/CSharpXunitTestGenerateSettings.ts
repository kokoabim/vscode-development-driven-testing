/**
 * C# Xunit test generation settings
 */
export class CSharpXunitTestGenerateSettings {
    targetProjectNamespace: string | undefined; // NOTE: not a user setting; used internally

    defaultNamespace = "DevelopmentDrivenTesting";
    disableCompilerWarnings = false;
    doNothingRegardingNullability = true;
    indentation = "    ";
    indicateTypeNullability = false;
    objectTypeForGenericParameters = true;
    reservedMethodNames = [
        "Equals",
        "GetHashCode",
        "GetType",
        "MemberwiseClone",
        "ToString"];
    testClassNamePrefixIfFileAlreadyExists = "Ddt";
    typesNotToBeIndicatedAsNullable = [
        "bool",
        "Boolean",
        "byte",
        "Byte",
        "char",
        "Char",
        "decimal",
        "Decimal",
        "double",
        "Double",
        "float",
        "int",
        "Int16",
        "Int32",
        "Int64",
        "IntPtr",
        "long",
        "nint",
        "nuint",
        "sbyte",
        "SByte",
        "short",
        "Single",
        "System.Boolean",
        "System.Byte",
        "System.Char",
        "System.Decimal",
        "System.Double",
        "System.Int16",
        "System.Int32",
        "System.Int64",
        "System.IntPtr",
        "System.SByte",
        "System.Single",
        "System.UInt16",
        "System.UInt32",
        "System.UInt64",
        "System.UIntPtr",
        "uint",
        "UInt16",
        "UInt32",
        "UInt64",
        "UIntPtr",
        "ulong",
        "ushort",
        "void"
    ];
    useOnlyNewOperatorForInstanceInstantiation = false;
    usingsFileContent = "global using Xunit;\n";
    warningsToDisable = ["CS8632", "IDE0018", "IDE0059", "IDE0090", "xUnit1024"];

    indent(level: number): string {
        return this.indentation.repeat(level);
    }
}
