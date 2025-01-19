import * as vscode from "vscode";
import "../Extensions/String.extensions";

export class VSCodeCSharp {
    private static _usingExpression: RegExp = /^\s*using\s+(?<namespace>[a-z0-9_\.]+)\s*;\s*?$/i;

    static async parseTextDocument(output: vscode.OutputChannel, document: vscode.TextDocument): Promise<CSharpClass[] | undefined> {
        return await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", document.uri).then(ds => {
            const documentRelativePath = vscode.workspace.asRelativePath(document.uri);
            const documentSymbols = ds as vscode.DocumentSymbol[];
            if (!ds || !documentSymbols || documentSymbols.length === 0) {
                output.appendLine(`${documentRelativePath}: No C# symbols found.`);
                return;
            }

            const cSharpClasses: CSharpClass[] = [];

            // classes within namespaces
            documentSymbols.filter(ds => ds.kind === vscode.SymbolKind.Namespace && ds.children.length > 0).forEach(namespaceSymbol => {
                const cSharpNamespace = new CSharpNamespace(namespaceSymbol.name);

                cSharpClasses.push(...namespaceSymbol.children.filter(c => c.kind === vscode.SymbolKind.Class).map(classSymbol => {
                    const cSharpClass = VSCodeCSharp.parseClass(document, classSymbol);
                    cSharpClass.namespace = cSharpNamespace;
                    return cSharpClass;
                }));
            });

            // classes without namespaces
            cSharpClasses.push(...documentSymbols.filter(ds => ds.kind === vscode.SymbolKind.Class).map(classSymbol => VSCodeCSharp.parseClass(document, classSymbol)));

            return cSharpClasses;
        });
    }

    static parseClass(document: vscode.TextDocument, symbol: vscode.DocumentSymbol): CSharpClass {
        const cSharpClass = new CSharpClass();

        if (symbol.detail.includes(".")) {
            cSharpClass.namespace = new CSharpNamespace(symbol.detail.substring(0, symbol.detail.lastIndexOf(".")));
        }

        cSharpClass.usings = this.parseUsings(document, symbol.range.start.line);
        cSharpClass.constructors.push(...symbol.children.filter(c => c.kind === vscode.SymbolKind.Constructor || c.name === '.ctor').map(constructorSymbol => VSCodeCSharp.parseConstructor(document, constructorSymbol)));
        cSharpClass.methods.push(...symbol.children.filter(c => c.kind === vscode.SymbolKind.Method && c.name !== '.ctor').map(methodSymbol => VSCodeCSharp.parseMethod(document, methodSymbol)));

        let symbolText, parametersText, attributes, keywords, structureType, implementsText, constraints;
        [symbolText, parametersText] = CSharpSymbol.extract(document, symbol);
        [symbolText, attributes] = CSharpSymbol.removeAttributes(symbolText);
        [symbolText, keywords] = CSharpSymbol.removeSymbolKeywords(symbolText);
        [symbolText, structureType] = CSharpClass.removeStructureType(symbolText);
        [symbolText, implementsText] = CSharpClass.removeImplements(symbolText);

        if (implementsText) { [implementsText, constraints] = CSharpSymbol.removeConstraints(implementsText); }
        else { [symbolText, constraints] = CSharpSymbol.removeConstraints(symbolText); }

        if (attributes) { cSharpClass.attributes.push(...attributes); }
        if (constraints) { cSharpClass.constraints.push(...constraints); }
        if (implementsText) { cSharpClass.implements.push(...CSharpSymbol.split(implementsText).map(i => CSharpClass.fromType(CSharpType.parse(i)))); }
        if (keywords) { cSharpClass.keywords.push(...keywords); }
        cSharpClass.structureType = structureType;

        const cSharpType = CSharpType.parse(symbolText);
        if (cSharpType.hasGenerics) { cSharpClass.generics.push(...cSharpType.generics); }
        cSharpClass.name = cSharpType.name;

        return cSharpClass;
    }

    static parseConstructor(document: vscode.TextDocument, symbol: vscode.DocumentSymbol): CSharpConstructor {
        let symbolText, parametersText, keywords;
        [symbolText, parametersText] = CSharpSymbol.extract(document, symbol);
        [symbolText, keywords] = CSharpSymbol.removeSymbolKeywords(symbolText);

        const cSharpConstructor = new CSharpConstructor();
        if (keywords) { cSharpConstructor.keywords.push(...keywords); }
        if (parametersText) { cSharpConstructor.parameters.push(...CSharpSymbol.split(parametersText).map(p => CSharpParameter.parse(p))); }

        const cSharpType = CSharpType.parse(symbolText);
        cSharpConstructor.name = cSharpType.name;

        return cSharpConstructor;
    }

    static parseMethod(document: vscode.TextDocument, symbol: vscode.DocumentSymbol): CSharpMethod {
        let symbolText, parametersText, attributes, keywords, constraints, returnTypeText;
        [symbolText, parametersText] = CSharpSymbol.extract(document, symbol);
        [symbolText, attributes] = CSharpSymbol.removeAttributes(symbolText);
        [symbolText, keywords] = CSharpSymbol.removeSymbolKeywords(symbolText);
        [symbolText, returnTypeText] = CSharpMethod.removeReturnType(symbolText);
        if (parametersText) { [parametersText, constraints] = CSharpSymbol.removeConstraints(parametersText); }

        const cSharpMethod = new CSharpMethod();
        if (attributes) { cSharpMethod.attributes.push(...attributes); }
        if (constraints) { cSharpMethod.constraints.push(...constraints); }
        if (keywords) { cSharpMethod.keywords.push(...keywords); }
        if (parametersText) { cSharpMethod.parameters.push(...CSharpSymbol.split(parametersText).map(p => CSharpParameter.parse(p))); }
        cSharpMethod.returnType = CSharpType.parse(returnTypeText);

        const cSharpType = CSharpType.parse(symbolText);
        if (cSharpType.hasGenerics) { cSharpMethod.generics.push(...cSharpType.generics); }
        cSharpMethod.name = cSharpType.name;

        return cSharpMethod;
    }

    static parseUsings(document: vscode.TextDocument, toLine: number): string[] {
        const usings: string[] = [];

        for (let i = 0; i < toLine; i++) {
            const line = document.lineAt(i).text.trim();
            if (line === "") { continue; }

            const usingMatch = VSCodeCSharp._usingExpression.exec(line);
            if (usingMatch && usingMatch.groups) {
                usings.push(usingMatch.groups.namespace);
                continue;
            }

            break; // only supporting usings at top of file (for now)
        }

        return usings;
    }
}

export abstract class CSharpSymbol {
    // @ts-ignore
    name: string;

    abstract definition(): string;
    toString(): string { return this.name; }

    private static readonly _symbolKeywords: string[] = ["abstract", "async", "extern", "file", "internal", "new", "override", "partial", "private", "protected", "public", "sealed", "static", "virtual"];

    protected static removeKeywords(symbolText: string, keywordsToRemove: string[]): [symbolText: string, keywords: string[] | undefined] {
        const keywords: string[] = [];

        let found: string | undefined;
        while ((found = symbolText.startsWithAny(keywordsToRemove, "", " ")) !== undefined) {
            keywords.push(found);
            symbolText = symbolText.substring(found.length + 1).trim();
        }

        return [symbolText, keywords.length > 0 ? keywords : undefined];
    }

    static extract(document: vscode.TextDocument, symbol: vscode.DocumentSymbol): [symbolText: string, parameters: string | undefined] {

        let symbolText = symbol.detail;
        if (symbol.kind === vscode.SymbolKind.Class) {
            if (symbol.detail.includes(".")) {
                symbolText = symbolText.substring(symbolText.lastIndexOf(".") + 1);
            }

            if (symbolText.includes("(")) {
                symbolText = symbolText.substring(0, symbolText.indexOf("("));
            }
        }

        let accessAndTypeRange = new vscode.Range(symbol.range.start, symbol.selectionRange.start);
        let accessAndType = document.getText(accessAndTypeRange);
        if (accessAndType.includes("//")) {
            accessAndType = accessAndType.replace(/\s*\/\/.*\s*/g, "");
        }
        if (accessAndType.includes("/*") && accessAndType.includes("*/")) {
            accessAndType = accessAndType.replace(/\s*\/\*.*\*\/\s*/g, "");
        }
        if (accessAndType.includes("[") && accessAndType.includes("]")) {
            accessAndType = accessAndType.replace(/\s*\[.{2,}\]\s*/g, "");
        }

        let definition = accessAndType + symbolText;

        if (symbol.kind === vscode.SymbolKind.Class) {
            return [definition, undefined];
        }

        let symbolName = symbol.name === '.ctor' ? symbol.detail : symbol.name;

        const generic = CSharpSymbol.getGeneric(symbol.detail);
        if (generic) { symbolName += generic; }

        const nameWithParenthesis = symbolName.indexOf("(") >= 0 ? symbolName.substring(0, symbolName.indexOf("(") + 1) : symbolName + "(";
        const parametersIndex = definition.indexOf(nameWithParenthesis) + nameWithParenthesis.length;
        const keywordsTypeName = definition.substring(0, parametersIndex - 1);
        const parameters = definition.substring(parametersIndex, definition.length - 1).trim();

        return [keywordsTypeName, parameters];
    }

    static getGeneric(detail: string): string {
        let m = detail.match(/^[^<>()]+(<.+>)\(.*\)$/);
        if (m) { return m[1]; }
        else { return ""; }
    }

    static removeAttributes(symbolText: string): [symbolText: string, attributes: string[] | undefined] {
        if (!symbolText.includes("[")) { return [symbolText, undefined]; }

        const attributes: string[] = [];
        let depth = 0;
        let index = 0;

        for (let i = 0; i < symbolText.length; i++) {
            const c = symbolText[i];

            if (c === "[") {
                depth++;
                if (depth === 1) {
                    index = i + 1;
                }
            }
            else if (c === "]") {
                depth--;
                if (depth === 0) {
                    attributes.push(symbolText.substring(index, i).trim());
                    index = i + 1;
                }
            }
            else if (depth === 0 && c !== " ") {
                break;
            }
        }

        symbolText = symbolText.substring(index).trim();

        return [symbolText, attributes.length > 0 ? attributes : undefined];
    }

    static removeConstraints(symbolOrImplementsOrMethodText: string): [symbolOrImplementsOrMethodText: string, constraints: string[] | undefined] {
        const split = symbolOrImplementsOrMethodText.split(" where ", 2);
        symbolOrImplementsOrMethodText = split[0].trim();
        const constraintsText = split.length === 2 ? split[1].trim() : undefined;
        const constraints = constraintsText ? constraintsText.split(" where ").map(c => c.trim()) : undefined;
        return [symbolOrImplementsOrMethodText, constraints];
    }

    static removeSymbolKeywords(symbolText: string): [symbolText: string, keywords: string[] | undefined] {
        return CSharpSymbol.removeKeywords(symbolText, CSharpSymbol._symbolKeywords);
    }

    static split(text: string, delimiter: string = ","): string[] {
        const depthIncreased = (c: string) => c === "<" || c === "[" || c === "(";
        const depthDecreased = (c: string) => c === ">" || c === "]" || c === ")";
        const symbols: string[] = [];

        let depth = 0;
        let index = 0;

        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (depthIncreased(c)) {
                depth++;
            }
            else if (depthDecreased(c)) {
                depth--;
            }
            else if (c === delimiter && depth === 0) {
                symbols.push(text.substring(index, i).trim());
                index = i + 1;
            }
        }

        symbols.push(text.substring(index).trim());

        return symbols;
    }
}

export class CSharpNamespace extends CSharpSymbol {
    classes: CSharpClass[] = [];

    static defaultName = "Namespace";

    constructor(name: string = CSharpNamespace.defaultName) {
        super();
        this.name = name;
    }

    definition(): string { return `namespace ${this.name}`; }
}

export class CSharpType extends CSharpSymbol {
    array: CSharpTypeArrayDimension[] = [];
    generics: CSharpType[] = [];
    get hasGenerics(): boolean { return this.generics.length > 0; }
    get isArray(): boolean { return this.array.length > 0; }
    isNullable: boolean = false;
    get isValueTuple(): boolean { return this.valueTuples.length > 0; }
    valueTuples: CSharpType[] = [];

    definition(): string { return this.toString(); }

    override toString(): string {
        let value;

        if (this.hasGenerics) {
            value = `${this.name}<${this.generics.map(g => g.toString()).join(", ")}>`;
        }
        else if (this.isValueTuple) {
            value = `(${this.valueTuples.map(v => v.toString()).join(", ")})`;
        }
        else {
            value = this.name;
        }

        if (this.isNullable) { value += "?"; }

        if (this.isArray) { value += this.array.map(a => a.isNullable ? "[]?" : "[]").join(""); }

        return value;
    }

    static parse(text: string): CSharpType {
        const cSharpType = new CSharpType();
        let depth = 0;
        let index = 0;

        if (text.startsWith("(") && text.endsWith(")")) {
            cSharpType.valueTuples.push(...CSharpSymbol.split(text.substring(1, text.length - 1)).map(t => CSharpType.parse(t)));
            return cSharpType;
        }

        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c === "<") {
                depth++;
                if (depth === 1) {
                    cSharpType.name = text.substring(index, i).trim();
                    index = i + 1;
                }
            }
            else if (c === ">") {
                depth--;
                if (depth === 0) {
                    cSharpType.generics.push(...CSharpSymbol.split(text.substring(index, i)).map(t => CSharpType.parse(t)));
                    index = i + 1;
                }
            }
            else if (c === "[") {
                depth++;
                if (depth === 1) {
                    if (!cSharpType.name) {
                        cSharpType.name = text.substring(index, i).trim();
                        index = i + 1;
                    }

                    if (i + 1 < text.length && text[i + 1] === "]") {
                        depth--;
                        const arrayDimension = new CSharpTypeArrayDimension();
                        index = i + 2;
                        i++;
                        if (i + 1 < text.length && text[i + 1] === "?") {
                            arrayDimension.isNullable = true;
                            index = i + 1;
                            i++;
                        }
                        cSharpType.array.push(arrayDimension);
                    }
                }
            }
            else if (c === "]") {
                depth--;
                if (depth === 0) {
                    const nullable = i + 1 < text.length && text[i + 1] === "?";
                    cSharpType.array.push(new CSharpTypeArrayDimension(nullable));
                    index = i + (nullable ? 2 : 1);
                    i = nullable ? i + 1 : i;
                }
            }
            else if (c === "?") {
                if (depth === 0) {
                    if (!cSharpType.name) { cSharpType.name = text.substring(index, i).trim(); }

                    cSharpType.isNullable = true;
                    index = i + 1;
                }
            }
        }

        if (!cSharpType.name) { cSharpType.name = text.substring(index).trim(); }

        return cSharpType;
    }
}

export class CSharpClass extends CSharpSymbol {
    attributes: string[] = [];
    constraints: string[] = [];
    constructors: CSharpConstructor[] = [];
    generics: CSharpType[] = [];
    get hasGenerics(): boolean { return this.generics.length > 0; }
    implements: CSharpClass[] = [];
    get isAbstract(): boolean { return this.keywords.includes("abstract"); }
    get isPublic(): boolean { return this.keywords.includes("public"); }
    get isStatic(): boolean { return this.keywords.includes("static"); }
    keywords: string[] = [];
    methods: CSharpMethod[] = [];
    namespace = new CSharpNamespace();
    structureType: string = "class";
    usings: string[] = [];

    private static readonly _structureTypes: string[] = [
        "class",
        "enum",
        "interface",
        "readonly record struct",
        "readonly ref struct",
        "readonly struct",
        "record class",
        "record struct",
        "record",
        "ref struct",
        "struct",
    ];

    definition(): string {
        let value = `${this.keywords.join(" ")} class ${this.toString()}`;
        if (this.implements.length > 0) { value += ` : ${this.implements.map(i => i.toString()).join(", ")}`; }
        return value.trim();
    }

    override toString(): string {
        if (this.hasGenerics) {
            return `${this.name}<${this.generics.map(g => g.toString()).join(", ")}>`;
        }
        else {
            return this.name;
        }
    }

    static fromType(type: CSharpType): CSharpClass {
        const cSharpClass = new CSharpClass();
        if (type.hasGenerics) { cSharpClass.generics.push(...type.generics); }
        cSharpClass.name = type.name;
        return cSharpClass;
    }

    static removeImplements(symbolText: string): [symbolText: string, implementsText: string | undefined] {
        const split = symbolText.split(":", 2);
        return [split[0].trim(), split.length === 2 ? split[1].trim() : undefined];
    }

    static removeStructureType(symbolText: string): [symbolText: string, structureType: string] {
        const structureType = symbolText.startsWithAny(CSharpClass._structureTypes, "", " ");
        if (structureType === undefined) { throw new Error("Data structure object type not found"); }
        symbolText = symbolText.substring(structureType.length + 1).trim();
        return [symbolText, structureType];
    }
}

export class CSharpConstructor extends CSharpSymbol {
    get hasParameters(): boolean { return this.parameters.length > 0; }
    get isAbstract(): boolean { return this.keywords.includes("abstract"); }
    get isPublic(): boolean { return this.keywords.includes("public"); }
    get isStatic(): boolean { return this.keywords.includes("static"); }
    keywords: string[] = [];
    parameters: CSharpParameter[] = [];

    definition(): string {
        return `${this.keywords.join(" ")} ${this.name}(${this.parameters.map(p => p.toString()).join(", ")})`.trim();
    }

    static createDefault(className: string): CSharpConstructor {
        const cSharpConstructor = new CSharpConstructor();
        cSharpConstructor.name = className;
        cSharpConstructor.keywords.push("public");
        return cSharpConstructor;
    }
}

export class CSharpMethod extends CSharpSymbol {
    attributes: string[] = [];
    constraints: string[] = [];
    generics: CSharpType[] = [];
    get hasGenerics(): boolean { return this.generics.length > 0; }
    get hasParameters(): boolean { return this.parameters.length > 0; }
    get isAbstract(): boolean { return this.keywords.includes("abstract"); }
    get isPublic(): boolean { return this.keywords.includes("public"); }
    get isStatic(): boolean { return this.keywords.includes("static"); }
    keywords: string[] = [];
    parameters: CSharpParameter[] = [];
    // @ts-ignore
    returnType: CSharpType;

    definition(): string {
        return `${this.keywords.join(" ")} ${this.returnType.toString()} ${this.toString()}(${this.parameters.map(p => p.toString()).join(", ")})`.trim();
    }

    override toString(): string {
        if (this.hasGenerics) {
            return `${this.name}<${this.generics.map(g => g.toString()).join(", ")}>`;
        }
        else {
            return this.name;
        }
    }

    static removeReturnType(methodText: string): [methodText: string, returnType: string] {
        const split = CSharpSymbol.split(methodText, " ");
        if (split.length !== 2) { throw new Error("Method return type not found"); }
        return [split[1].trim(), split[0].trim()];
    }
}

export class CSharpParameter extends CSharpSymbol {
    attributes: string[] = [];
    defaultValue: CSharpParameterValue | undefined;
    get isOptional(): boolean { return this.defaultValue !== undefined; }
    get isOut(): boolean { return this.keywords.includes("out"); }
    keywords: string[] = [];
    // @ts-ignore
    type: CSharpType;

    definition(): string { return this.toString(); }

    outOrRef(): string {
        return this.isOut ? "out " : this.keywords.includes("ref") ? "ref " : "";
    }

    override toString(): string {
        return `${this.keywords.join(" ")} ${this.type.definition()} ${this.name}${this.isOptional ? ` = ${this.defaultValue!.toString()}` : ""}`.trim();
    }

    private static readonly _parameterKeywords: string[] = ["in", "out", "params", "ref", "this"];

    private static removeDefaultValue(parameterText: string): [parameterText: string, defaultValue: CSharpParameterValue | undefined] {
        if (!parameterText.includes("=")) { return [parameterText, undefined]; }

        const split = parameterText.split("=", 2);
        parameterText = split[0].trim();
        return [parameterText, new CSharpParameterValue(split[1].trim())];
    }

    private static removeParameterKeywords(parameterText: string): [parameterText: string, keywords: string[] | undefined] {
        return CSharpSymbol.removeKeywords(parameterText, CSharpParameter._parameterKeywords);
    }

    static parse(parameterText: string): CSharpParameter {
        let attributes, defaultValue, keywords;
        [parameterText, attributes] = CSharpSymbol.removeAttributes(parameterText);
        [parameterText, keywords] = CSharpParameter.removeParameterKeywords(parameterText);
        [parameterText, defaultValue] = CSharpParameter.removeDefaultValue(parameterText);

        const cSharpParameter = new CSharpParameter();
        if (attributes) { cSharpParameter.attributes.push(...attributes); }
        if (keywords) { cSharpParameter.keywords.push(...keywords); }
        if (defaultValue) { cSharpParameter.defaultValue = defaultValue; }

        const split = CSharpSymbol.split(parameterText, " ");
        if (split.length !== 2) { throw new Error("Parameter type and name not found"); }
        cSharpParameter.name = split[1].trim();
        cSharpParameter.type = CSharpType.parse(split[0].trim());

        return cSharpParameter;
    }
}

export class CSharpTypeArrayDimension {
    constructor(public isNullable: boolean = false) { }
}

export class CSharpParameterValue {
    get isDefault(): boolean { return this.value === "default"; }
    get isNull(): boolean { return this.value === "null"; }

    constructor(public value: any = undefined) { }

    toString(): string {
        return this.value.toString();
    }
}
