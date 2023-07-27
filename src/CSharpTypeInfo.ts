export class CSharpTypeInfo {
    base: string;
    fullName: string;
    genericType: CSharpTypeInfo | undefined;
    isArray: boolean = false;
    isNullable: boolean = false;

    private _parseExpression: RegExp = /^(?<base>[a-z0-9_]+)(\<(?<generic>.*?)\>)?(?<array>\[\])?(?<nullable>\?)?$/i;

    constructor(typeName: string) {
        this.fullName = typeName;

        const m = this._parseExpression.exec(this.fullName);
        if (!m || !m.groups) { throw new Error(`Type name '${typeName}' is not valid.`); }

        this.base = m.groups.base;
        if (m.groups.generic) { this.genericType = new CSharpTypeInfo(m.groups.generic); }
        m.groups.array && (this.isArray = true);
        m.groups.nullable && (this.isNullable = true);
    }
}
