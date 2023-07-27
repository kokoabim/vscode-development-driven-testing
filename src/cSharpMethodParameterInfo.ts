import { CSharpTypeInfo } from "./CSharpTypeInfo";

/**
 * C# method parameter information
 */
export class CSharpMethodParameterInfo {
    attribute: string | undefined;
    isOut: boolean = false;
    isParams: boolean = false;
    isRef: boolean = false;
    typeInfo: CSharpTypeInfo | undefined;
    name: string | undefined;
    defaultValue: string | undefined;

    private static _parameterExpression: RegExp = /(?<attr>\[.*?\] +)?(?<out>out +)?(?<params>params +)?(?<ref>ref +)?(?<type>.*?) +(?<name>[a-z0-9_]+)( *= *(?<default>.*?))?( *, *|$)/gi;

    constructor(init?: Partial<CSharpMethodParameterInfo>) {
        Object.assign(this, init);
    }

    static create(parametersString: string | undefined): CSharpMethodParameterInfo[] {
        return parametersString ? this._parameterExpression.matches(parametersString).map(match =>
            new CSharpMethodParameterInfo({
                attribute: match.groups?.attr,
                isOut: match.groups?.out !== undefined,
                isParams: match.groups?.params !== undefined,
                isRef: match.groups?.ref !== undefined,
                typeInfo: new CSharpTypeInfo(match.groups!.type),
                name: match.groups!.name,
                defaultValue: match.groups?.default
            })
        ) : [];
    }
}
