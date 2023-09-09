declare global {
    interface Array<T> {
        groupBy<K extends keyof T>(key: K): Map<T[K], T[]>;
    }
}

Array.prototype.groupBy = function <T, K extends keyof T>(key: K): Map<T[K], T[]> {
    return this.reduce((map, item) => {
        const keyValue = item[key];
        const group = map.get(keyValue);
        if (group) {
            group.push(item);
        } else {
            map.set(keyValue, [item]);
        }
        return map;
    }, new Map<T[K], T[]>());
};

export { };