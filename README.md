# @corvid-agent/result

Type-safe error handling with `Result<T, E>`. Chainable, pipeable, zero-throw. Zero deps. TypeScript-first.

## Install

```bash
npm install @corvid-agent/result
```

## Usage

### Creating Results

```ts
import { ok, err } from "@corvid-agent/result";

const success = ok(42);       // Result<number, never>
const failure = err("oops");  // Result<never, string>
```

### Wrapping Throwable Code

```ts
import { trySync, tryAsync } from "@corvid-agent/result";

// Synchronous
const parsed = trySync(() => JSON.parse(rawInput));
// Result<any, Error>

// Asynchronous
const data = await tryAsync(() => fetch(url).then(r => r.json()));
// Result<any, Error>

// From an existing promise
const result = await fromPromise(someAsyncCall());
```

### Transforming Values

```ts
const r = ok(10)
  .map(x => x * 2)        // Ok(20)
  .map(x => `val: ${x}`); // Ok("val: 20")

// Errors pass through map unchanged
err("fail").map(x => x * 2); // Err("fail")
```

### Chaining with flatMap

```ts
const divide = (a: number, b: number) =>
  b === 0 ? err("division by zero") : ok(a / b);

ok(100)
  .flatMap(x => divide(x, 2))   // Ok(50)
  .flatMap(x => divide(x, 0))   // Err("division by zero")
  .flatMap(x => divide(x, 5));  // skipped
```

### Pattern Matching

```ts
const message = result.match({
  ok:  value => `Success: ${value}`,
  err: error => `Failed: ${error}`,
});
```

### Unwrapping

```ts
result.unwrap();              // Returns value or throws error
result.unwrapOr(defaultVal);  // Returns value or fallback
result.unwrapOrElse(e => 0);  // Returns value or computed fallback
result.unwrapErr();           // Returns error or throws
```

### Combining Results

```ts
import { all, allTuple, any } from "@corvid-agent/result";

// Collect homogeneous results
all([ok(1), ok(2), ok(3)]);       // Ok([1, 2, 3])
all([ok(1), err("x"), ok(3)]);    // Err("x")

// Collect heterogeneous results with preserved types
allTuple(ok(1), ok("hi"), ok(true)); // Ok([1, "hi", true])

// Take the first success
any([err("a"), ok(42), ok(99)]);  // Ok(42)
```

### Nullable Conversion

```ts
import { fromNullable } from "@corvid-agent/result";

fromNullable(value, "value was null");
// Ok(value) if non-null, Err("value was null") otherwise
```

## Works with @corvid-agent/pipe

`@corvid-agent/result` pairs naturally with [`@corvid-agent/pipe`](https://github.com/corvid-agent/pipe) for railway-oriented programming — pipe a value through a series of transforms, with errors short-circuiting via `Result`.

### Pipe a value through Result transforms

```ts
import { pipe } from "@corvid-agent/pipe";
import { trySync } from "@corvid-agent/result";

const items = pipe(
  '{"items": [1, null, 3]}',
  (input: string) => trySync(() => JSON.parse(input)),
  (result) => result.map((data) => data.items),
  (result) => result.map((items) => items.filter(Boolean)),
  (result) => result.unwrapOr([]),
);
// [1, 3]
```

### Create reusable pipelines with flow

```ts
import { flow } from "@corvid-agent/pipe";
import { trySync } from "@corvid-agent/result";

const parseItems = flow(
  (input: string) => trySync(() => JSON.parse(input)),
  (result) => result.map((data) => data.items),
  (result) => result.map((items) => items.filter(Boolean)),
  (result) => result.unwrapOr([]),
);

parseItems('{"items": [1, null, 3]}'); // [1, 3]
parseItems("not json");                // []
```

### Async pipelines

```ts
import { pipeAsync } from "@corvid-agent/pipe";
import { tryAsync } from "@corvid-agent/result";

const data = await pipeAsync(
  "https://api.example.com/data",
  (url: string) => tryAsync(() => fetch(url).then((r) => r.json())),
  (result) => result.map((json) => json.items),
  (result) => result.unwrapOr([]),
);
```

## API Reference

| Function | Description |
|----------|-------------|
| `ok(value)` | Create a successful Result |
| `err(error)` | Create a failed Result |
| `trySync(fn)` | Wrap a synchronous call in a Result |
| `tryAsync(fn)` | Wrap an async call or promise in a Result |
| `fromNullable(value, error)` | Convert nullable to Result |
| `fromPromise(promise)` | Convert a Promise to Promise\<Result\> |
| `all(results)` | Collect array of Results (first error wins) |
| `allTuple(...results)` | Collect tuple of Results with preserved types |
| `any(results)` | Return first Ok (last error if all fail) |

### Result Methods

| Method | Description |
|--------|-------------|
| `.isOk()` | Type guard for Ok variant |
| `.isErr()` | Type guard for Err variant |
| `.map(fn)` | Transform the Ok value |
| `.mapErr(fn)` | Transform the Err value |
| `.flatMap(fn)` | Chain Result-returning functions |
| `.match({ ok, err })` | Pattern match on Ok/Err |
| `.unwrap()` | Get value or throw error |
| `.unwrapOr(fallback)` | Get value or use fallback |
| `.unwrapOrElse(fn)` | Get value or compute fallback |
| `.unwrapErr()` | Get error or throw |
| `.toJSON()` | Serialize to plain object |

## License

MIT
