export class CappedMap<K, V> {
    protected store: Map<K, V> = new Map<K, V>();

    public constructor(private maxSize: number) {}

    public get(key: K): V | undefined {
        return this.store.get(key);
    }

    public set(key: K, value: V): void {
        if (this.store.size >= this.maxSize) {
            this.store.delete(Array.from(this.store)[0][0]);
        }

        this.store = this.store.set(key, value);
    }

    public has(key: K): boolean {
        return this.store.has(key);
    }

    public delete(key: K): boolean {
        if (!this.store.has(key)) {
            return false;
        }

        this.store.delete(key);

        return !this.store.has(key);
    }

    public clear(): void {
        this.store.clear();
    }

    public resize(maxSize: number): void {
        this.maxSize = maxSize;

        if (this.store.size > this.maxSize) {
            this.store = new Map<K, V>(Array.from(this.store).slice(-Math.max(0, this.maxSize)));
        }
    }

    public first(): V {
        return Array.from(this.store)[0][1];
    }

    public last(): V {
        return Array.from(this.store)[this.store.size - 1][1];
    }

    public keys(): K[] {
        return [...this.store.keys()];
    }

    public values(): V[] {
        return [...this.store.values()];
    }

    public count(): number {
        return this.store.size;
    }
}
