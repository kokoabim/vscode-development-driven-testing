declare global {
    interface String {
        equalsAny(values: string[], prefix?: string, suffix?: string): string | undefined;
        startsWithAny(values: string[], prefix?: string, suffix?: string): string | undefined;
    }
};

String.prototype.equalsAny = function (values: string[], prefix: string = "", suffix: string = ""): string | undefined {
    return values.find(value => this === prefix + value + suffix);
};

String.prototype.startsWithAny = function (values: string[], prefix: string = "", suffix: string = ""): string | undefined {
    return values.find(value => this.startsWith(prefix + value + suffix));
};

export { };
