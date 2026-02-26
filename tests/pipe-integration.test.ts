import { describe, test, expect } from "bun:test";
import { pipe, pipeAsync, flow } from "@corvid-agent/pipe";
import { ok, err, trySync, tryAsync } from "../src/index";

describe("pipe + result integration", () => {
  test("pipe: parse JSON and extract values", () => {
    const items = pipe(
      '{"items": [1, null, 3]}',
      (input: string) => trySync(() => JSON.parse(input)),
      (result) => result.map((data: { items: unknown[] }) => data.items),
      (result) => result.map((items: unknown[]) => items.filter(Boolean)),
      (result) => result.unwrapOr([] as unknown[]),
    );
    expect(items).toEqual([1, 3]);
  });

  test("pipe: invalid JSON falls back to default", () => {
    const items = pipe(
      "not json",
      (input: string) => trySync(() => JSON.parse(input)),
      (result) => result.map((data: { items: unknown[] }) => data.items),
      (result) => result.unwrapOr([] as unknown[]),
    );
    expect(items).toEqual([]);
  });

  test("pipe: map and flatMap chain through pipe", () => {
    const value = pipe(
      ok(10),
      (r) => r.map((x: number) => x * 2),
      (r) => r.flatMap((x: number) => (x > 15 ? ok(x) : err("too small"))),
      (r) => r.unwrapOr(0),
    );
    expect(value).toBe(20);
  });

  test("pipe: error short-circuits through map chain", () => {
    const value = pipe(
      err("initial error") as ReturnType<typeof ok<number>>,
      (r) => r.map((x: number) => x * 2),
      (r) => r.map((x: number) => x + 1),
      (r) =>
        r.match({
          ok: (v: number) => `ok: ${v}`,
          err: (e: string) => `err: ${e}`,
        }),
    );
    expect(value).toBe("err: initial error");
  });
});

describe("flow + result integration", () => {
  test("flow: create reusable JSON parser pipeline", () => {
    const parseItems = flow(
      (input: string) => trySync(() => JSON.parse(input)),
      (result) => result.map((data: { items: unknown[] }) => data.items),
      (result) => result.map((items: unknown[]) => items.filter(Boolean)),
      (result) => result.unwrapOr([] as unknown[]),
    );

    expect(parseItems('{"items": [1, null, 3]}')).toEqual([1, 3]);
    expect(parseItems("not json")).toEqual([]);
    expect(parseItems('{"items": []}')).toEqual([]);
  });

  test("flow: reusable validation pipeline", () => {
    const validateAge = flow(
      (input: string) => trySync(() => parseInt(input, 10)),
      (result) =>
        result.flatMap((n: number) =>
          isNaN(n) ? err(new Error("not a number")) : ok(n),
        ),
      (result) =>
        result.flatMap((n: number) =>
          n >= 0 && n <= 150 ? ok(n) : err(new Error("out of range")),
        ),
      (result) => result.unwrapOr(-1),
    );

    expect(validateAge("25")).toBe(25);
    expect(validateAge("200")).toBe(-1);
    expect(validateAge("abc")).toBe(-1);
  });
});

describe("pipeAsync + result integration", () => {
  test("pipeAsync: async pipeline with tryAsync", async () => {
    const result = await pipeAsync(
      '{"value": 42}',
      (input: string) =>
        tryAsync(() => Promise.resolve(JSON.parse(input))),
      (result) => result.map((data: { value: number }) => data.value),
      (result) => result.unwrapOr(0),
    );
    expect(result).toBe(42);
  });

  test("pipeAsync: async error falls back gracefully", async () => {
    const result = await pipeAsync(
      "bad json",
      (input: string) =>
        tryAsync(() => Promise.reject(new Error("parse failed"))),
      (result) => result.unwrapOr("default"),
    );
    expect(result).toBe("default");
  });
});
