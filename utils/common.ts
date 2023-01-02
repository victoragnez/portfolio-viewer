type StringGen = string | (() => string);

export function assertNever(_x: never, msg?: StringGen): never {
  unexpected(msg);
}

export function unexpected(msg?: StringGen): never {
  debugger;
  throw new Error(
    (typeof msg === "function" ? msg() : msg) ?? "Unexpected branch"
  );
}

export function assert<T>(cond: T, msg: StringGen): asserts cond {
  if (!cond) {
    debugger;
    throw new Error(
      (typeof msg === "function" ? msg() : msg) ?? "Assertion failed"
    );
  }
}

export function swallow<T>(f: () => T): T | null {
  try {
    return f();
  } catch (e) {
    return null;
  }
}

export async function swallowAsync<T>(f: () => Promise<T>): Promise<T | null> {
  try {
    return await f();
  } catch (e) {
    return null;
  }
}

export function shuffleArray<T extends any[]>(array: T): T {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
