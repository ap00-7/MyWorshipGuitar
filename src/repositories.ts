export interface Repository<T> {
  load(): T
  save(value: T): void
}

export class LocalRepository<T> implements Repository<T> {
  constructor(private readonly key: string, private readonly fallback: T) {}

  load() {
    try {
      const value = localStorage.getItem(this.key)
      return value ? JSON.parse(value) as T : this.fallback
    } catch {
      return this.fallback
    }
  }

  save(value: T) {
    localStorage.setItem(this.key, JSON.stringify(value))
  }
}
