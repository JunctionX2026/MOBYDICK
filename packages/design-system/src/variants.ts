type ClassInput = string | readonly string[];

type VariantMap = Record<string, Record<string, ClassInput>>;

/**
 * `{ true: ..., false: ... }` reads as a boolean prop at the call site,
 * while any other option set reads as a union of its keys.
 */
type Option<O> = "true" extends keyof O ? boolean : Extract<keyof O, string>;

export type VariantSelection<V extends VariantMap> = {
  [K in keyof V]?: Option<V[K]>;
};

export type VariantProps<T> = T extends (selection?: infer S) => string ? NonNullable<S> : never;

interface VariantConfig<V extends VariantMap> {
  base?: ClassInput;
  variants: V;
  defaults?: VariantSelection<V>;
  compound?: ReadonlyArray<VariantSelection<V> & { class: ClassInput }>;
}

function push(target: string[], value: ClassInput | undefined): void {
  if (value === undefined) {
    return;
  }

  if (typeof value === "string") {
    if (value !== "") {
      target.push(value);
    }
    return;
  }

  target.push(...value.filter((entry) => entry !== ""));
}

/**
 * Builds a class name from a variant selection. Unlike a plain lookup table
 * this resolves defaults for omitted keys and applies compound rules, so a
 * component never has to branch on variants itself.
 */
export function variants<const V extends VariantMap>(config: VariantConfig<V>) {
  const { base, compound = [], variants: options } = config;
  const defaults: VariantSelection<V> = config.defaults ?? {};
  const names = Object.keys(options) as Array<keyof V>;

  return (selection: VariantSelection<V> = {}): string => {
    const resolved = {} as Record<keyof V, string | undefined>;
    const classNames: string[] = [];

    push(classNames, base);

    for (const name of names) {
      const value = selection[name] ?? defaults[name];
      resolved[name] = value === undefined ? undefined : String(value);

      const key = resolved[name];
      if (key !== undefined) {
        push(classNames, options[name]?.[key]);
      }
    }

    for (const rule of compound) {
      const matches = names.every((name) => {
        const expected = rule[name];
        return expected === undefined || String(expected) === resolved[name];
      });

      if (matches) {
        push(classNames, rule.class);
      }
    }

    return classNames.join(" ");
  };
}
