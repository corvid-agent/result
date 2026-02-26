/**
 * @corvid-agent/result
 *
 * Type-safe error handling with Result<T, E>.
 * Chainable, pipeable, zero-throw. Zero deps. TypeScript-first.
 *
 * @example
 * ```ts
 * import { ok, err, trySync, tryAsync } from "@corvid-agent/result";
 *
 * const parsed = trySync(() => JSON.parse(input));
 * const value = parsed.unwrapOr({ fallback: true });
 *
 * const fetched = await tryAsync(() => fetch(url).then(r => r.json()));
 * const data = fetched.map(d => d.items).unwrapOr([]);
 * ```
 */

// -- Types ----

/** Discriminated union tag for Ok variant. */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
  readonly error?: never;
}

/** Discriminated union tag for Err variant. */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
  readonly value?: never;
}

/**
 * A Result represents either success (Ok) or failure (Err).
 * Use `ok()` and `err()` to create instances, then chain with
 * `.map()`, `.mapErr()`, `.flatMap()`, `.match()`, etc.
 */
export type Result<T, E = Error> = (Ok<T> | Err<E>) & ResultMethods<T, E>;

/** Methods available on every Result instance. */
export interface ResultMethods<T, E> {
  /** Returns true if the result is Ok. */
  isOk(): boolean;
  /** Returns true if the result is Err. */
  isErr(): boolean;

  /** Transform the Ok value. Err passes through unchanged. */
  map<U>(fn: (value: T) => U): Result<U, E>;
  /** Transform the Err value. Ok passes through unchanged. */
  mapErr<F>(fn: (error: E) => F): Result<T, F>;

  /** Chain a Result-returning function on Ok. Err passes through. */
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E>;

  /** Pattern match on Ok/Err. */
  match<A, B>(cases: { ok: (value: T) => A; err: (error: E) => B }): A | B;

  /** Unwrap the Ok value or throw the Err. */
  unwrap(): T;
  /** Unwrap the Ok value or return the fallback. */
  unwrapOr<U>(fallback: U): T | U;
  /** Unwrap the Ok value or compute a fallback from the error. */
  unwrapOrElse<U>(fn: (error: E) => U): T | U;
  /** Unwrap the Err value or throw if Ok. */
  unwrapErr(): E;

  /** Convert to a plain object { ok, value?, error? } for serialization. */
  toJSON(): { ok: true; value: T } | { ok: false; error: E };
}

// -- Internal helpers ----

function createOk<T>(value: T): Result<T, never> {
  const self: Ok<T> & ResultMethods<T, never> = {
    ok: true,
    value,

    isOk() {
      return true;
    },
    isErr() {
      return false;
    },

    map<U>(fn: (value: T) => U): Result<U, never> {
      return createOk(fn(self.value));
    },
    mapErr() {
      return self as unknown as Result<T, never>;
    },

    flatMap<U>(fn: (value: T) => Result<U, never>): Result<U, never> {
      return fn(self.value);
    },

    match<A, B>(cases: { ok: (value: T) => A; err: (error: never) => B }) {
      return cases.ok(self.value);
    },

    unwrap() {
      return self.value;
    },
    unwrapOr() {
      return self.value;
    },
    unwrapOrElse() {
      return self.value;
    },
    unwrapErr(): never {
      throw new Error("Called unwrapErr() on an Ok result");
    },

    toJSON() {
      return { ok: true as const, value: self.value };
    },
  };

  return self;
}

function createErr<E>(error: E): Result<never, E> {
  const self: Err<E> & ResultMethods<never, E> = {
    ok: false,
    error,

    isOk() {
      return false;
    },
    isErr() {
      return true;
    },

    map() {
      return self as unknown as Result<never, E>;
    },
    mapErr<F>(fn: (error: E) => F): Result<never, F> {
      return createErr(fn(self.error));
    },

    flatMap() {
      return self as unknown as Result<never, E>;
    },

    match<A, B>(cases: { ok: (value: never) => A; err: (error: E) => B }) {
      return cases.err(self.error);
    },

    unwrap(): never {
      throw self.error instanceof Error
        ? self.error
        : new Error(String(self.error));
    },
    unwrapOr<U>(fallback: U) {
      return fallback;
    },
    unwrapOrElse<U>(fn: (error: E) => U) {
      return fn(self.error);
    },
    unwrapErr() {
      return self.error;
    },

    toJSON() {
      return { ok: false as const, error: self.error };
    },
  };

  return self;
}

// -- Constructors ----

/** Create a successful Result containing `value`. */
export function ok<T>(value: T): Result<T, never> {
  return createOk(value);
}

/** Create a failed Result containing `error`. */
export function err<E>(error: E): Result<never, E> {
  return createErr(error);
}

// -- Type guards ----

/** Type guard: narrows a Result to its Ok variant. */
export function isOk<T, E>(result: Result<T, E>): result is Result<T, E> & Ok<T> {
  return result.ok;
}

/** Type guard: narrows a Result to its Err variant. */
export function isErr<T, E>(result: Result<T, E>): result is Result<T, E> & Err<E> {
  return !result.ok;
}

// -- Try wrappers ----

/**
 * Wrap a synchronous function call in a Result.
 * Returns Ok(returnValue) on success, Err(thrownError) on throw.
 */
export function trySync<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Wrap an async function or promise in a Result.
 * Returns Ok(resolvedValue) on success, Err(rejectedError) on rejection.
 */
export async function tryAsync<T>(
  fn: (() => Promise<T>) | Promise<T>,
): Promise<Result<T, Error>> {
  try {
    const value = await (typeof fn === "function" ? fn() : fn);
    return ok(value);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

// -- Combining Results ----

/**
 * Collect an array of Results into a single Result.
 * If all are Ok, returns Ok with an array of values.
 * If any is Err, returns the first Err.
 */
export function all<T, E>(
  results: readonly Result<T, E>[],
): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result as unknown as Result<T[], E>;
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Like `all`, but with a tuple of differently-typed Results.
 * Preserves individual types in the output tuple.
 */
export function allTuple<Results extends readonly Result<unknown, unknown>[]>(
  ...results: Results
): Result<
  { [K in keyof Results]: Results[K] extends Result<infer T, unknown> ? T : never },
  { [K in keyof Results]: Results[K] extends Result<unknown, infer E> ? E : never }[number]
> {
  const values: unknown[] = [];
  for (const result of results) {
    if (!result.ok) return result as never;
    values.push(result.value);
  }
  return ok(values) as never;
}

/**
 * Return the first Ok result from an array of Results.
 * If all are Err, returns the last Err.
 */
export function any<T, E>(
  results: readonly Result<T, E>[],
): Result<T, E> {
  if (results.length === 0) {
    return err(new Error("any() called with empty array") as unknown as E);
  }
  for (const result of results) {
    if (result.isOk()) return result;
  }
  return results[results.length - 1];
}

// -- fromNullable / fromPromise ----

/**
 * Convert a nullable value to a Result.
 * Returns Err if the value is null or undefined.
 */
export function fromNullable<T, E>(
  value: T | null | undefined,
  error: E,
): Result<T, E> {
  return value != null ? ok(value) : err(error);
}

/**
 * Convert a Promise to a Promise<Result>.
 * Alias for tryAsync with a promise argument.
 */
export function fromPromise<T>(
  promise: Promise<T>,
): Promise<Result<T, Error>> {
  return tryAsync(promise);
}
