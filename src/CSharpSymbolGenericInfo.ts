export class CSharpSymbolGenericInfo {
    base: string;
    fullName: string;
    isArray: boolean = false;
    isNullable: boolean = false;

    private _parseExpression: RegExp = /^(?<base>[a-z0-9_]+)(?<array>\[\])?(?<nullable>\?)?$/i;

    constructor(typeName: string) {
        this.fullName = typeName;

        let m = this._parseExpression.exec(typeName);
        if (!m || !m.groups) { throw new Error(`Generic '${typeName}' is not valid.`); }

        this.base = m.groups.base;
        m.groups.array && (this.isArray = true);
        m.groups.nullable && (this.isNullable = true);
    }
}
