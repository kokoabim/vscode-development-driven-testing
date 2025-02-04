import * as fs from "fs/promises";
import * as fss from "fs";

import crypto = require('crypto');
import path = require("path");

import { FileInfo } from "../Utils/FileInfo";
import { glob } from "glob";
import { resolve } from "path";
import { tmpdir } from "os";

enum FileSystemWriteType {
    append,
    write
}

export class FileSystem {
    static appendFile(filePath: string, dataOrObject: any, includeNullUndefinedOnStringify: boolean = true): Promise<void> {
        return this.writeFileInternalAsync(filePath, dataOrObject, FileSystemWriteType.append, false, includeNullUndefinedOnStringify);
    }

    static basename(filePath: string): string { return path.basename(filePath); }

    static async deleteFileAsync(path: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            await this.existsAsync(path).then(async exists => {
                await fs.unlink(path).then(() => {
                    resolve();
                }, err => reject(err));
            }, err => reject(err));
        });
    }

    static dirname(filePath: string): string { return path.dirname(filePath); }

    static async existsAsync(path: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            await fs.access(path, fs.constants.F_OK).then(() => {
                resolve(true);
            }, err => {
                if (err.code === 'ENOENT') { resolve(false); return; }
                reject(err);
            });
        });
    }

    static exists(path: string): boolean {
        return fss.existsSync(path);
    }

    static extension(filePath: string, includeLeadingDot: boolean = true): string {
        const fileExt = path.extname(filePath);
        if (!fileExt) { return ""; }
        return includeLeadingDot ? fileExt : fileExt.substring(1);
    }

    static fileName(filePath: string, withoutExtension: boolean = false): string { return path.basename(filePath, withoutExtension ? this.extension(filePath) : ""); }

    static async getFileInfosAsync(path: string, basePath?: string): Promise<FileInfo[]> {
        path = resolve(path) + '/';
        basePath ??= path;
        const dirents = await fs.readdir(path, { withFileTypes: true });
        const files = await Promise.all(dirents.map(async de => {
            const direntPath = resolve(path, de.name);
            if (de.isDirectory()) { return await this.getFileInfosAsync(direntPath, basePath); }
            if (!de.isFile()) { return []; }
            const stats = await fs.stat(direntPath);
            return new FileInfo(direntPath.replace(basePath!, ""), stats.mtime.getTime(), stats.size);
        }));
        return files.flat();
    }

    static async getStatsAsync(path: string): Promise<fss.Stats> {
        return new Promise<fss.Stats>(async (resolve, reject) => {
            return await fs.stat(path).then(stats => resolve(stats), err => reject(err));
        });
    }

    static async globAsync(pattern: string, options?: any): Promise<string[]> {
        return await glob(pattern, options);
    }

    static joinPaths(...paths: string[]): string { return path.join(...paths); }

    static async makeDirAsync(thePath: string, pathIsfile: boolean = false): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (pathIsfile) { thePath = path.dirname(thePath); }
            await fs.mkdir(thePath, { recursive: true }).then(() => resolve(), err => reject(err));
        });
    }

    static async moveFileAsync(sourceFile: string, targetFile: string, overwrite: boolean = false): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (!(await this.existsAsync(sourceFile))) { reject(`File not found: ${sourceFile}`); return; }
            else if (!overwrite && (await this.existsAsync(targetFile))) { reject(`File already exists: ${targetFile}`); return; }

            const targetDirName = path.dirname(targetFile);
            if (!(await this.existsAsync(targetDirName))) { await this.makeDirAsync(targetDirName); }

            await fs.rename(sourceFile, targetFile).then(() => {
                resolve();
            }, err => {
                reject(err);
            });
        });
    }

    static async readFileAsync(filePath: string): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            if (!this.existsAsync(filePath)) { reject(new Error(`File not found: ${filePath}`)); return; }

            await fs.readFile(filePath).then(data => {
                resolve(Buffer.from(data).toString("utf8"));
            }, err => {
                reject(err);
            });
        });
    }

    static async readFileAsJsonAsync(filePath: string): Promise<any> {
        return new Promise<string>(async (resolve, reject) => {
            if (!this.existsAsync(filePath)) { reject(new Error(`File not found: ${filePath}`)); return; }

            await fs.readFile(filePath).then(data => {
                resolve(JSON.parse(Buffer.from(data).toString("utf8")));
            }, err => {
                reject(err);
            });
        });
    }

    static resolvePaths(...paths: string[]): string { return path.resolve(...paths); }

    static tempFileName(): string { return path.join(tmpdir(), crypto.randomUUID()); }

    static writeFile(filePath: string, dataOrObject: any, overwrite: boolean = false, includeNullUndefinedOnStringify: boolean = true): Promise<void> {
        return this.writeFileInternalAsync(filePath, dataOrObject, FileSystemWriteType.write, overwrite, includeNullUndefinedOnStringify);
    }

    static async writeTempFileAsync(data?: string): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            const fileName = this.tempFileName();
            await this.writeFile(fileName, data ?? "", true).then(() => {
                resolve(fileName);
            }, async err => {
                await this.deleteFileAsync(fileName);
                reject(err);
            });
        });
    }

    private static async writeFileInternalAsync(filePath: string, dataOrObject: any, writeType: FileSystemWriteType, overwrite: boolean = false, includeNullUndefinedOnStringify: boolean = true): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (writeType === FileSystemWriteType.write && !overwrite && (await this.existsAsync(filePath))) { reject(`File already exists: ${filePath}`); return; }

            const data = typeof dataOrObject === "string" ? dataOrObject : JSON.stringify(dataOrObject, (_, val) => {
                if (includeNullUndefinedOnStringify || (val !== null && val !== undefined)) { return val; }
            }, 4);

            const dirName = path.dirname(filePath);
            if (!(await this.existsAsync(dirName))) { await this.makeDirAsync(dirName); }

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