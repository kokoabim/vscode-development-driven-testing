import { FileSystem } from '../../Utils/FileSystem';

export class CSharpProjectFile {
    get directory(): string { return CSharpProjectFile._fileSystem.dirname(this.filePath); }
    get isTestProject(): boolean { return this._fileContent !== undefined && this._fileContent?.includes('<IsTestProject>true</IsTestProject>'); }

    private _fileContent: string | undefined;
    private static _fileSystem: FileSystem = new FileSystem();

    constructor(
        public readonly filePath: string,
        public readonly relativePath: string) { }

    static async findProjects(workspaceDirectory: string): Promise<CSharpProjectFile[]> {
        return await CSharpProjectFile._fileSystem.glob(workspaceDirectory + '/**/*.csproj').then(async files => {
            const cSharpProjectFiles = files.map(f => new CSharpProjectFile(f, f.replace(workspaceDirectory, "")));
            for await (const f of cSharpProjectFiles) { await f.readFile(); }
            return cSharpProjectFiles;
        }, error => {
            throw error;
        });
    }

    async readFile(): Promise<void> {
        if (this._fileContent) { return; }
        await CSharpProjectFile._fileSystem.readFile(this.filePath).then(content => {
            this._fileContent = content;
        }, error => {
            throw error;
        });
    }
}