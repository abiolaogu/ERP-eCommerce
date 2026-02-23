declare function describe(name: string, fn: () => void | Promise<void>): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function expect(actual: unknown): Expectation;

declare namespace describe {
  const skip: typeof describe;
  const only: typeof describe;
}

declare namespace it {
  const skip: typeof it;
  const only: typeof it;
}

interface Expectation {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toHaveLength(expected: number): void;
}
