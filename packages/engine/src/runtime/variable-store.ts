/**
 * Dynamic Runtime Variable Store for tutorial execution context.
 */
export class VariableStore {
  private variables: Map<string, unknown>;

  constructor(initialData: Record<string, unknown> = {}) {
    this.variables = new Map(Object.entries(initialData));
  }

  get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    return this.variables.has(key) ? (this.variables.get(key) as T) : defaultValue;
  }

  set(key: string, value: unknown): void {
    this.variables.set(key, value);
  }

  has(key: string): boolean {
    return this.variables.has(key);
  }

  delete(key: string): boolean {
    return this.variables.delete(key);
  }

  clear(): void {
    this.variables.clear();
  }

  toObject(): Record<string, unknown> {
    return Object.fromEntries(this.variables);
  }
}
