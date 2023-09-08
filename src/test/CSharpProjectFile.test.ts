import * as assert from 'assert';
import * as fs from 'fs';
import { CSharpProjectFile } from '../CSharp/ProjectFile/CSharpProjectFile';

class TestSettings {
    static testSolutionDir = "/Users/spencer/Projects/MyClassLib";

    static ready(): boolean {
        return TestSettings.testSolutionDir !== "" && fs.existsSync(TestSettings.testSolutionDir);
    }
}

const testIt = () => TestSettings.ready() ? it : it.skip;

describe("CSharpProjectFile", () => {
    testIt()("findProjects()", async () => {
        const actual = await CSharpProjectFile.findProjects(TestSettings.testSolutionDir);
        assert.ok(actual);
        assert.equal(actual.length, 3);
        assert.equal(actual.filter(f => f.isTestProject).length, 2);
    });
});
