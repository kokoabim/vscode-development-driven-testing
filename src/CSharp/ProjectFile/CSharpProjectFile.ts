import { FileSystem } from '../../Utils/FileSystem';

export class CSharpProjectFile {
    defaultNamespace: string | undefined;
    directory: string | undefined;
    isTestProject: boolean = false;

    private _fileContent: string | undefined;
    private static _fileSystem: FileSystem = new FileSystem();

    constructor(
        public readonly name: string,
        public readonly filePath: string,
        public readonly relativePath: string) { }

    static async findProjects(workspaceDirectory: string): Promise<CSharpProjectFile[]> {
        return await CSharpProjectFile._fileSystem.glob(workspaceDirectory + '/**/*.csproj').then(async files => {
            const cSharpProjectFiles = files.map(f => new CSharpProjectFile(CSharpProjectFile._fileSystem.fileName(f, true), f, f.replace(workspaceDirectory + "/", "")));
            for await (const f of cSharpProjectFiles) { await f.readFile(); }
            return cSharpProjectFiles;
        }, error => {
            throw error;
        });
    }

    async readFile(): Promise<void> {
        this.directory = CSharpProjectFile._fileSystem.dirname(this.filePath);

        await CSharpProjectFile._fileSystem.readFile(this.filePath).then(content => {
            this._fileContent = content;
        }, error => {
            throw error;
        });

        if (this._fileContent) {
            this.defaultNamespace = this._fileContent.match(/<RootNamespace>(.*)<\/RootNamespace>/)?.[1]
                || this._fileContent!.match(/<AssemblyName>(.*)<\/AssemblyName>/)?.[1]
                || this.filePath.match(/([^\/\\]+)\.csproj$/)?.[1];

            this.isTestProject = this._fileContent?.includes('<IsTestProject>true</IsTestProject>');
        }
    }
}