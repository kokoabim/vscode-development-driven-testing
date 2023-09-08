import * as fs from "fs/promises";
import * as fss from "fs";
import { FileInfo } from "../Utils/FileInfo";
import { resolve } from "path";
import { tmpdir } from "os";
import { glob } from 'glob';
import path = require("path");
import crypto = require('crypto');

export interface IFileSystem {
    appendFile(filePath: string, dataOrObject: any, includeNullUndefinedOnStringify?: boolean): Promise<void>;
    basename(filePath: string): string;
    deleteFile(path: string): Promise<void>;
    dirname(filePath: string): string;
    exists(path: string): Promise<boolean>;
    existsSync(path: string): boolean;
    extension(filePath: string, includeLeadingDot?: boolean): string;
    fileName(filePath: string, withoutExtension?: boolean): string;
    getFileInfos(path: string): Promise<FileInfo[]>;
    getStats(path: string): Promise<fss.Stats>;
    glob(pattern: string, options?: any): Promise<string[]>;
    joinPaths(...paths: string[]): string;
    makeDir(path: string, pathIsfile?: boolean): Promise<void>;
    moveFile(sourceFile: string, targetFile: string, overwrite?: boolean): Promise<void>;
    readFile(filePath: string): Promise<string>;
    readFileAsJson(filePath: string): Promise<any>;
    resolvePaths(...paths: string[]): string;
    tempFileName(): string;
    writeFile(filePath: string, dataOrObject: any, overwrite?: boolean, includeNullUndefinedOnStringify?: boolean): Promise<void>;
    writeTempFile(data?: string): Promise<string>;
}

export class FileSystem implements IFileSystem {

    appendFile(filePath: string, dataOrObject: any, includeNullUndefinedOnStringify: boolean = true): Promise<void> {
        return this.writeFileInternal(filePath, dataOrObject, FileSystemWriteType.append, false, includeNullUndefinedOnStringify);
    }

    basename(filePath: string): string { return path.basename(filePath); }

    async deleteFile(path: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.exists(path).then(async exists => {
                await fs.unlink(path).then(() => {
                    resolve();
                }, err => reject(err));
            }, err => reject(err));
        });
    }

    dirname(filePath: string): string { return path.dirname(filePath); }

    async exists(path: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            await fs.access(path, fs.constants.F_OK).then(() => {
                resolve(true);
            }, err => {
                if (err.code === 'ENOENT') { resolve(false); return; }
                reject(err);
            });
        });
    }

    existsSync(path: string): boolean {
        return fss.existsSync(path);
    }

    extension(filePath: string, includeLeadingDot: boolean = true): string {
        const fileExt = path.extname(filePath);
        if (!fileExt) { return ""; }
        return includeLeadingDot ? fileExt : fileExt.substring(1);
    }

    fileName(filePath: string, withoutExtension: boolean = false): string { return path.basename(filePath, withoutExtension ? this.extension(filePath) : ""); }

    async getFileInfos(path: string, basePath?: string): Promise<FileInfo[]> {
        path = resolve(path) + '/';
        basePath ??= path;
        const dirents = await fs.readdir(path, { withFileTypes: true });
        const files = await Promise.all(dirents.map(async de => {
            const direntPath = resolve(path, de.name);
            if (de.isDirectory()) { return await this.getFileInfos(direntPath, basePath); }
            if (!de.isFile()) { return []; }
            const stats = await fs.stat(direntPath);
            return new FileInfo(direntPath.replace(basePath!, ""), stats.mtime.getTime(), stats.size);
        }));
        return files.flat();
    }

    async getStats(path: string): Promise<fss.Stats> {
        return new Promise<fss.Stats>(async (resolve, reject) => {
            return await fs.stat(path).then(stats => resolve(stats), err => reject(err));
        });
    }

    async glob(pattern: string, options?: any): Promise<string[]> {
        return await glob(pattern, options);
    }

    joinPaths(...paths: string[]): string { return path.join(...paths); }

    async makeDir(thePath: string, pathIsfile: boolean = false): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (pathIsfile) { thePath = path.dirname(thePath); }
            await fs.mkdir(thePath, { recursive: true }).then(() => resolve(), err => reject(err));
        });
    }

    async moveFile(sourceFile: string, targetFile: string, overwrite: boolean = false): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (!(await this.exists(sourceFile))) { reject(`File not found: ${sourceFile}`); return; }
            else if (!overwrite && (await this.exists(targetFile))) { reject(`File already exists: ${targetFile}`); return; }

            const targetDirName = path.dirname(targetFile);
            if (!(await this.exists(targetDirName))) { await this.makeDir(targetDirName); }

            await fs.rename(sourceFile, targetFile).then(() => {
                resolve();
            }, err => {
                reject(err);
            });
        });
    }

    async readFile(filePath: string): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            if (!this.exists(filePath)) { reject(new Error(`File not found: ${filePath}`)); return; }

            await fs.readFile(filePath).then(data => {
                resolve(Buffer.from(data).toString("utf8"));
            }, err => {
                reject(err);
            });
        });
    }

    async readFileAsJson(filePath: string): Promise<any> {
        return new Promise<string>(async (resolve, reject) => {
            if (!this.exists(filePath)) { reject(new Error(`File not found: ${filePath}`)); return; }

            await fs.readFile(filePath).then(data => {
                resolve(JSON.parse(Buffer.from(data).toString("utf8")));
            }, err => {
                reject(err);
            });
        });
    }

    resolvePaths(...paths: string[]): string { return path.resolve(...paths); }

    tempFileName(): string {
        return path.join(tmpdir(), crypto.randomUUID());
    }

    writeFile(filePath: string, dataOrObject: any, overwrite: boolean = false, includeNullUndefinedOnStringify: boolean = true): Promise<void> {
        return this.writeFileInternal(filePath, dataOrObject, FileSystemWriteType.write, overwrite, includeNullUndefinedOnStringify);
    }

    async writeTempFile(data?: string): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            const fileName = this.tempFileName();
            await this.writeFile(fileName, data ?? "", true).then(() => {
                resolve(fileName);
            }, async err => {
                await this.deleteFile(fileName);
                reject(err);
            });
        });
    }

    private async writeFileInternal(filePath: string, dataOrObject: any, writeType: FileSystemWriteType, overwrite: boolean = false, includeNullUndefinedOnStringify: boolean = true): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (writeType === FileSystemWriteType.write && !overwrite && (await this.exists(filePath))) { reject(`File already exists: ${filePath}`); return; }

            const data = typeof dataOrObject === "string" ? dataOrObject : JSON.stringify(dataOrObject, (_, val) => {
                if (includeNullUndefinedOnStringify || (val !== null && val !== undefined)) { return val; }
            }, 4);

            const dirName = path.dirname(filePath);
            if (!(await this.exists(dirName))) { await this.makeDir(dirName); }

            if (writeType === FileSystemWriteType.write) {
                await fs.writeFile(filePath, data).then(() => {
                    resolve();
                }, err => {
                    reject(err);
                });
            }
            else if (writeType === FileSystemWriteType.append) {
                await fs.appendFile(filePath, data).then(() => {
                    resolve();
                }, err => {
                    reject(err);
                });
            }
        });
    }
}

enum FileSystemWriteType {
    append,
    write
}