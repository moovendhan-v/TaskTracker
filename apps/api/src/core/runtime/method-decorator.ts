/** Any async method. Decorators wrap these without knowing their exact signature. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- decorators must accept every method signature
export type AsyncMethod = (...args: any[]) => Promise<any>;

/**
 * Builds a method decorator that replaces an async method with `wrap(original)`.
 * The wrapper keeps `this`, so the original still sees its injected dependencies.
 */
export function wrapMethod(wrap: (original: AsyncMethod, name: string) => AsyncMethod): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    const original = descriptor.value as unknown;
    if (typeof original !== 'function') throw new Error(`Only methods can be decorated (${String(propertyKey)})`);
    const name = `${(target as { constructor: { name: string } }).constructor.name}.${String(propertyKey)}`;
    const wrapped = wrap(original as AsyncMethod, name);
    Object.defineProperty(wrapped, 'name', { value: (original as AsyncMethod).name });
    descriptor.value = wrapped as typeof descriptor.value;
    return descriptor;
  };
}
