import * as assert from 'assert';
import * as vscode from 'vscode';
import { CSharpClass, CSharpType, CSharpTypeArrayDimension } from '../../CSharp/VSCodeCSharp';

suite("CSharpClass", () => {
    vscode.window.showInformationMessage('Starting tests.');

    test("toString() - name only", () => {
        // arrange/act
        const target = CSharpTestHelper.generateClass("Foo", ["public"]);

        // assert
        assert.equal(target.toString(), "Foo");
    });

    test("definition() - name only", () => {
        // arrange/act
        const target = CSharpTestHelper.generateClass("Foo", ["public"]);

        // assert
        assert.equal(target.definition(), "public class Foo");
    });

    test("toString() - generic", () => {
        // arrange/act
        const target = CSharpTestHelper.generateClass("Foo", ["public"], [CSharpTestHelper.generateType("T")], [CSharpTestHelper.generateClass("Bar")]);

        // assert
        assert.equal(target.toString(), "Foo<T>");
    });

    test("definition() - generic", () => {
        // arrange/act
        const target = CSharpTestHelper.generateClass("Foo", ["public"], [CSharpTestHelper.generateType("T")], [CSharpTestHelper.generateClass("Bar")]);

        // assert
        assert.equal(target.definition(), "public class Foo<T> : Bar");
    });
});

suite("CSharpType", () => {
    vscode.window.showInformationMessage('Starting tests.');

    test("toString() - name only", () => {
        // arrange/act
        const target = CSharpTestHelper.generateType("Foo");

        // assert
        assert.equal(target.toString(), "Foo");
    });

    test("toString() - complex", () => {
        // arrange/act
        const target = CSharpTestHelper.generateType("Foo", true, [true], [CSharpTestHelper.generateType("T")]);

        // assert
        assert.equal(target.toString(), "Foo<T>?[]?");
    });

    test("toString() - simple dictionary", () => {
        // arrange/act
        const target = CSharpTestHelper.generateType("Dictionary", false, [], [CSharpTestHelper.generateType("TKey"), CSharpTestHelper.generateType("TValue")]);

        // assert
        assert.equal(target.toString(), "Dictionary<TKey, TValue>");
    });

    test("toString() - complex dictionary", () => {
        // arrange/act
        const target = CSharpTestHelper.generateType("Dictionary", false, [], [CSharpTestHelper.generateType("string"), CSharpTestHelper.generateType("IEnumerable", false, [], [CSharpTestHelper.generateType("int")])]);

        // assert
        assert.equal(target.toString(), "Dictionary<string, IEnumerable<int>>");
    });

    test("toString() - ValueTuple", () => {
        // arrange/act
        const target = CSharpTestHelper.generateValueTuple(CSharpTestHelper.generateType("Foo"), CSharpTestHelper.generateType("Bar"));

        // assert
        assert.equal(target.toString(), "(Foo, Bar)");
    });
});

class CSharpTestHelper {
    static generateClass(name: string, withKeywords: string[] = [], withGenerics: CSharpType[] = [], implementing: CSharpClass[] = []): CSharpClass {
        const obj = new CSharpClass();
        if (implementing.length > 0) { obj.implements.push(...implementing); }
        if (withGenerics.length > 0) { obj.generics.push(...withGenerics); }
        if (withKeywords.length > 0) { obj.keywords.push(...withKeywords); }
        obj.name = name;
        return obj;
    }

    static generateType(name: string, isNullable: boolean = false, asArray: boolean[] = [], withGenerics: CSharpType[] = []): CSharpType {
        const obj = new CSharpType();
        if (asArray.length > 0) { obj.array.push(...asArray.map(a => new CSharpTypeArrayDimension(a))); }
        if (withGenerics.length > 0) { obj.generics.push(...withGenerics); }
        obj.isNullable = isNullable;
        obj.name = name;
        return obj;
    }

    static generateValueTuple(...types: CSharpType[]): CSharpType {
        const obj = new CSharpType();
        obj.valueTuples.push(...types);
        return obj;
    }
}
