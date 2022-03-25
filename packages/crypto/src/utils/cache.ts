export class Cache<K, V> {
    private readonly cache = new Map<K, V>();

    public constructor(private readonly maxSize: number) {}

    public has(key: K): boolean {
        return this.cache.has(key);
    }

    public get(key: K): V | undefined {
        return this.cache.get(key);
    }

    public set(key: K, value: V): void {
        this.cache.set(key, value);

        if (this.cache.size > this.maxSize) {
            this.cache.delete(this.firstKey());
        }
    }

    private firstKey(): K {
        return this.cache.keys().next().value;
    }
}
