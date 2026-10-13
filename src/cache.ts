interface Entry<T> {
  expiresAt: number;
  promise: Promise<T>;
}

// Bounded, exact-key cache. Failed requests are never cached.
export class AsyncCache<T> {
  private entries = new Map<string, Entry<T>>();
  constructor(
    private maxEntries = 100,
    private ttlMs = 5 * 60 * 1000,
    private now: () => number = Date.now,
  ) {}

  get(key: string, create: () => Promise<T>): Promise<T> {
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > this.now()) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached.promise;
    }
    this.entries.delete(key);
    const entry: Entry<T> = {
      expiresAt: this.now() + this.ttlMs,
      promise: Promise.resolve().then(create),
    };
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value as string);
    }
    entry.promise = entry.promise.catch(error => {
      if (this.entries.get(key) === entry) this.entries.delete(key);
      throw error;
    });
    return entry.promise;
  }
}