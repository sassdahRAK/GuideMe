/**
 * Dynamic Runtime Variable Store for tutorial execution context.
 */
export class VariableStore {
  constructor(initialData = {}) {
    this.variables = new Map(Object.entries(initialData));
  }

  get(key, defaultValue = undefined) {
    return this.variables.has(key) ? this.variables.get(key) : defaultValue;
  }

  set(key, value) {
    this.variables.set(key, value);
  }

  has(key) {
    return this.variables.has(key);
  }

  delete(key) {
    return this.variables.delete(key);
  }

  clear() {
    this.variables.clear();
  }

  toObject() {
    return Object.fromEntries(this.variables);
  }
}
