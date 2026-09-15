export type OptimisticItem = { number: string; amount: number };

const english = (value: string) => value.replace(/[၀-၉]/g, (digit) => String("၀၁၂၃၄၅၆၇၈၉".indexOf(digit)));
const permutations = (value: string) => { const out = new Set<string>(); const visit = (prefix: string, rest: string) => rest ? [...new Set(rest)].forEach((digit) => visit(prefix + digit, rest.replace(digit, ""))) : out.add(prefix); visit("", value); return [...out]; };
const wildcards = (value: string) => [...value].reduce<string[]>((all, char) => char === "/" ? all.flatMap((prefix) => [..."0123456789"].map((digit) => prefix + digit)) : all.map((prefix) => prefix + char), [""]);

function expand(rule: string, amount: number, permutation = false): OptimisticItem[] | null {
  if (rule === "A") return [..."0123456789"].map((digit) => ({ number: digit.repeat(3), amount }));
  if (rule.includes("/")) { const groups = (rule.replace(/\./g, "").match(/[\d/]{3}/g) || []); return groups.length && groups.join("").length === rule.replace(/\./g, "").length ? groups.flatMap((group) => wildcards(group).map((number) => ({ number, amount }))) : null; }
  if (permutation) { const groups = (rule.replace(/\./g, "").match(/\d{3}/g) || []); return groups.length && groups.join("").length === rule.replace(/\./g, "").length ? groups.flatMap((group) => permutations(group).map((number) => ({ number, amount }))) : null; }
  return /^\d{1,3}$/.test(rule) ? [{ number: rule.padStart(3, "0"), amount }] : null;
}

function token(raw: string): OptimisticItem[] | null {
  const value = english(raw).replace(/,/g, "").toUpperCase();
  let match = value.match(/^(.+?)-(\d+)$/); if (match) return expand(match[1], Number(match[2]));
  match = value.match(/^(.+?)[R*](\d+)$/); if (match) return expand(match[1], Number(match[2]), true);
  match = value.match(/^(A|\d{1,3}[R*])(\d+)$/); if (match) return expand(match[1].replace(/[R*]$/, ""), Number(match[2]), /[R*]$/.test(match[1]));
  if (/^[\d/]+$/.test(value)) { const length = [4, 3, 2, 1].find((size) => value.length - size >= 3 && (value.length - size) % 3 === 0); if (length) return expand(value.slice(0, -length), Number(value.slice(-length))); }
  if (/^\d+$/.test(value)) { const length = [4, 3, 2, 1].find((size) => value.length - size >= 3 && (value.length - size) % 3 === 0); if (length) { const amount = Number(value.slice(-length)); const numbers = value.slice(0, -length).match(/\d{3}/g) || []; return amount ? numbers.map((number) => ({ number, amount })) : null; } }
  return null;
}

export function parseOptimisticSales(raw: string) { const items = raw.split(/\s+/).filter(Boolean).flatMap((part) => token(part) || []); return items.length ? items : null; }
