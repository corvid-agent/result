import { describe, test, expect } from "bun:test";
import {
  ok,
  err,
  trySync,
  tryAsync,
  all,
  allTuple,
  any,
  partition,
  fromNullable,
  fromPromise,
} from "../src/index";

describe("ok", () => {
  test("creates an Ok result", () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
  });

  test("isOk returns true", () => {
    expect(ok(1).isOk()).toBe(true);
  });

  test("isErr returns false", () => {
    expect(ok(1).isErr()).toBe(false);
  });
});

describe("err", () => {
  test("creates an Err result", () => {
    const r = err("fail");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("fail");
  });

  test("isOk returns false", () => {
    expect(err("fail").isOk()).toBe(false);
  });

  test("isErr returns true", () => {
    expect(err("fail").isErr()).toBe(true);
  });
});

describe("map", () => {
  test("transforms Ok value", () => {
    const r = ok(2).map((x) => x * 3);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(6);
  });

  test("passes Err through unchanged", () => {
    const r = err("fail").map(() => 99);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("fail");
  });
});

describe("mapErr", () => {
  test("transforms Err value", () => {
    const r = err("fail").mapErr((e) => e.toUpperCase());
    expect(r.ok).toBe(false);
    expect(r.error).toBe("FAIL");
  });

  test("passes Ok through unchanged", () => {
    const r = ok(42).mapErr(() => "nope");
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
  });
});

describe("flatMap", () => {
  test("chains Ok results", () => {
    const r = ok(10).flatMap((x) => ok(x + 5));
    expect(r.ok).toBe(true);
    expect(r.value).toBe(15);
  });

  test("short-circuits on Err", () => {
    const r = err("fail").flatMap(() => ok(99));
    expect(r.ok).toBe(false);
    expect(r.error).toBe("fail");
  });

  test("propagates inner Err", () => {
    const r = ok(10).flatMap(() => err("inner fail"));
    expect(r.ok).toBe(false);
    expect(r.error).toBe("inner fail");
  });
});

describe("match", () => {
  test("calls ok branch for Ok", () => {
    const result = ok(42).match({
      ok: (v) => `value: ${v}`,
      err: (e) => `error: ${e}`,
    });
    expect(result).toBe("value: 42");
  });

  test("calls err branch for Err", () => {
    const result = err("fail").match({
      ok: (v) => `value: ${v}`,
      err: (e) => `error: ${e}`,
    });
    expect(result).toBe("error: fail");
  });
});

describe("unwrap", () => {
  test("returns value for Ok", () => {
    expect(ok(42).unwrap()).toBe(42);
  });

  test("throws for Err with Error instance", () => {
    const e = new Error("test error");
    expect(() => err(e).unwrap()).toThrow("test error");
  });

  test("throws wrapped error for Err with non-Error", () => {
    expect(() => err("string error").unwrap()).toThrow("string error");
  });
});

describe("unwrapOr", () => {
  test("returns value for Ok", () => {
    expect(ok(42).unwrapOr(0)).toBe(42);
  });

  test("returns fallback for Err", () => {
    expect(err("fail").unwrapOr(0)).toBe(0);
  });
});

describe("unwrapOrElse", () => {
  test("returns value for Ok", () => {
    expect(ok(42).unwrapOrElse(() => 0)).toBe(42);
  });

  test("computes fallback for Err", () => {
    const r = err("fail").unwrapOrElse((e) => `recovered: ${e}`);
    expect(r).toBe("recovered: fail");
  });
});

describe("unwrapErr", () => {
  test("returns error for Err", () => {
    expect(err("fail").unwrapErr()).toBe("fail");
  });

  test("throws for Ok", () => {
    expect(() => ok(42).unwrapErr()).toThrow("Called unwrapErr() on an Ok result");
  });
});

describe("toJSON", () => {
  test("serializes Ok", () => {
    expect(ok(42).toJSON()).toEqual({ ok: true, value: 42 });
  });

  test("serializes Err", () => {
    expect(err("fail").toJSON()).toEqual({ ok: false, error: "fail" });
  });

  test("works with JSON.stringify", () => {
    const json = JSON.stringify(ok({ x: 1 }));
    expect(JSON.parse(json)).toEqual({ ok: true, value: { x: 1 } });
  });
});

describe("trySync", () => {
  test("wraps successful call in Ok", () => {
    const r = trySync(() => JSON.parse('{"a":1}'));
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ a: 1 });
  });

  test("wraps thrown error in Err", () => {
    const r = trySync(() => JSON.parse("invalid"));
    expect(r.ok).toBe(false);
    expect(r.error).toBeInstanceOf(Error);
  });

  test("wraps non-Error throws in Err with Error", () => {
    const r = trySync(() => {
      throw "string throw";
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBeInstanceOf(Error);
    expect(r.error.message).toBe("string throw");
  });
});

describe("tryAsync", () => {
  test("wraps resolved promise in Ok", async () => {
    const r = await tryAsync(() => Promise.resolve(42));
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
  });

  test("wraps rejected promise in Err", async () => {
    const r = await tryAsync(() => Promise.reject(new Error("async fail")));
    expect(r.ok).toBe(false);
    expect(r.error.message).toBe("async fail");
  });

  test("accepts a promise directly", async () => {
    const r = await tryAsync(Promise.resolve("direct"));
    expect(r.ok).toBe(true);
    expect(r.value).toBe("direct");
  });

  test("wraps non-Error rejection in Err with Error", async () => {
    const r = await tryAsync(() => Promise.reject("string rejection"));
    expect(r.ok).toBe(false);
    expect(r.error).toBeInstanceOf(Error);
    expect(r.error.message).toBe("string rejection");
  });
});

describe("all", () => {
  test("collects all Ok values into an array", () => {
    const r = all([ok(1), ok(2), ok(3)]);
    expect(r.ok).toBe(true);
    expect(r.value).toEqual([1, 2, 3]);
  });

  test("returns first Err", () => {
    const r = all([ok(1), err("fail"), ok(3)]);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("fail");
  });

  test("handles empty array", () => {
    const r = all([]);
    expect(r.ok).toBe(true);
    expect(r.value).toEqual([]);
  });
});

describe("allTuple", () => {
  test("collects differently-typed Ok values", () => {
    const r = allTuple(ok(1), ok("hello"), ok(true));
    expect(r.ok).toBe(true);
    expect(r.value).toEqual([1, "hello", true]);
  });

  test("returns first Err from tuple", () => {
    const r = allTuple(ok(1), err("fail"), ok(true));
    expect(r.ok).toBe(false);
    expect(r.error).toBe("fail");
  });
});

describe("any", () => {
  test("returns first Ok", () => {
    const r = any([err("a"), ok(42), ok(99)]);
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
  });

  test("returns last Err if all fail", () => {
    const r = any([err("a"), err("b"), err("c")]);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("c");
  });

  test("returns Err for empty array", () => {
    const r = any([]);
    expect(r.ok).toBe(false);
  });
});

describe("partition", () => {
  test("splits mixed Results into successes and failures", () => {
    const [successes, failures] = partition([ok(1), err("a"), ok(2), err("b")]);
    expect(successes).toEqual([1, 2]);
    expect(failures).toEqual(["a", "b"]);
  });

  test("returns all values when all Ok", () => {
    const [successes, failures] = partition([ok(1), ok(2), ok(3)]);
    expect(successes).toEqual([1, 2, 3]);
    expect(failures).toEqual([]);
  });

  test("returns all errors when all Err", () => {
    const [successes, failures] = partition([err("a"), err("b"), err("c")]);
    expect(successes).toEqual([]);
    expect(failures).toEqual(["a", "b", "c"]);
  });

  test("handles empty array", () => {
    const [successes, failures] = partition([]);
    expect(successes).toEqual([]);
    expect(failures).toEqual([]);
  });

  test("preserves order", () => {
    const [successes, failures] = partition([ok(3), err("x"), ok(1), err("y"), ok(2)]);
    expect(successes).toEqual([3, 1, 2]);
    expect(failures).toEqual(["x", "y"]);
  });
});

describe("fromNullable", () => {
  test("returns Ok for non-null value", () => {
    const r = fromNullable(42, "was null");
    expect(r.ok).toBe(true);
    expect(r.value).toBe(42);
  });

  test("returns Err for null", () => {
    const r = fromNullable(null, "was null");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("was null");
  });

  test("returns Err for undefined", () => {
    const r = fromNullable(undefined, "was undefined");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("was undefined");
  });

  test("returns Ok for falsy non-null values", () => {
    expect(fromNullable(0, "err").ok).toBe(true);
    expect(fromNullable("", "err").ok).toBe(true);
    expect(fromNullable(false, "err").ok).toBe(true);
  });
});

describe("fromPromise", () => {
  test("wraps resolved promise in Ok", async () => {
    const r = await fromPromise(Promise.resolve("ok"));
    expect(r.ok).toBe(true);
    expect(r.value).toBe("ok");
  });

  test("wraps rejected promise in Err", async () => {
    const r = await fromPromise(Promise.reject(new Error("fail")));
    expect(r.ok).toBe(false);
    expect(r.error.message).toBe("fail");
  });
});

describe("chaining", () => {
  test("map chain works end to end", () => {
    const r = ok(10)
      .map((x) => x * 2)
      .map((x) => x + 1)
      .map((x) => `result: ${x}`);
    expect(r.value).toBe("result: 21");
  });

  test("flatMap chain short-circuits on error", () => {
    const divide = (a: number, b: number) =>
      b === 0 ? err("division by zero") : ok(a / b);

    const r = ok(100)
      .flatMap((x) => divide(x, 2))
      .flatMap((x) => divide(x, 0))
      .flatMap((x) => divide(x, 5));

    expect(r.ok).toBe(false);
    expect(r.error).toBe("division by zero");
  });
});
