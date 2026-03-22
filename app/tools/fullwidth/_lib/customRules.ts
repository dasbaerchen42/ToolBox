import type { FullwidthCustomRule } from "./types";

export function normalizeCustomRules(
  rules: FullwidthCustomRule[]
): FullwidthCustomRule[] {
  return [...rules]
    .filter((rule) => rule.enabled && rule.from !== "")
    .sort((a, b) => b.from.length - a.from.length);
}

export function applyCustomRules(
  text: string,
  rules: FullwidthCustomRule[]
): string {
  let output = text;
  const normalizedRules = normalizeCustomRules(rules);

  for (const rule of normalizedRules) {
    output = output.split(rule.from).join(rule.to);
  }

  return output;
}

export function createEmptyCustomRule(): FullwidthCustomRule {
  return {
    id: `rule-${crypto.randomUUID()}`,
    from: "",
    to: "",
    enabled: true,
  };
}