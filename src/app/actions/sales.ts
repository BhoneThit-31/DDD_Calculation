"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SaveSalesState = { error?: string; success?: string };

const toEnglishDigits = (value: string) => value.replace(/[၀-၉]/g, (digit) => String("၀၁၂၃၄၅၆၇၈၉".indexOf(digit)));

function uniquePermutations(value: string) {
  const result = new Set<string>();
  const visit = (prefix: string, remaining: string) => {
    if (!remaining) {
      result.add(prefix);
      return;
    }
    [...new Set(remaining.split(""))].forEach((digit) => {
      visit(prefix + digit, remaining.replace(digit, ""));
    });
  };
  visit("", value);
  return [...result];
}

function wildcardNumbers(pattern: string) {
  if (!/^[\d/]{3}$/.test(pattern)) return null;
  return [...pattern].reduce<string[]>((numbers, character) => character === "/" ? numbers.flatMap((number) => ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => number + digit)) : numbers.map((number) => number + character), [""]);
}

function expandRule(rule: string, amount: number, permutation: boolean) {
  if (rule === "A") return { numbers: Array.from({ length: 10 }, (_, digit) => `${digit}${digit}${digit}`), amount, ruleType: "all_same" };
  if (rule.includes("/")) {
    const wildcardDigits = rule.replace(/\./g, "");
    if (wildcardDigits.length % 3 !== 0) return null;
    const patterns = wildcardDigits.match(/[\d/]{3}/g) || [];
    const numbers = patterns.flatMap((pattern) => wildcardNumbers(pattern) || []);
    if (!numbers.length || patterns.some((pattern) => !wildcardNumbers(pattern))) return null;
    return { numbers, amount, ruleType: "wildcard" };
  }
  if (permutation) {
    const digits = rule.replace(/\./g, "");
    if (!/^\d+$/.test(digits) || digits.length % 3 !== 0) return null;
    const groups = digits.match(/\d{1,3}/g) || [];
    return { numbers: groups.flatMap((group) => uniquePermutations(group.padStart(3, "0"))), amount, ruleType: groups.length > 1 ? "multi_permutation" : "permutation" };
  }
  if (/^\d{1,3}$/.test(rule)) return { numbers: [rule.padStart(3, "0")], amount, ruleType: "direct" };
  return null;
}

function parseRuleLine(line: string) {
  const normalized = toEnglishDigits(line).replace(/,/g, "").trim().toUpperCase();
  let match = normalized.match(/^(.+?)-(\d+(?:\.\d+)?)$/);
  let rule = match?.[1]?.replace(/\s+/g, "") || "";
  let amount = match ? Number(match[2]) : NaN;
  let permutation = false;

  if (!match) {
    match = normalized.match(/^(.+?)[R*]\s*(\d+(?:\.\d+)?)$/);
    if (match) { rule = match[1].replace(/\s+/g, ""); amount = Number(match[2]); permutation = true; }
  }
  if (!match) {
    match = normalized.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
    if (match) { rule = match[1].replace(/\s+/g, ""); amount = Number(match[2]); permutation = /[R*]$/.test(rule); if (permutation) rule = rule.slice(0, -1); }
  }
  if (!match) {
    match = normalized.match(/^(A|\d{1,3}[R*])(\d+(?:\.\d+)?)$/);
    if (match) { rule = match[1]; amount = Number(match[2]); permutation = /[R*]$/.test(rule); if (permutation) rule = rule.slice(0, -1); }
  }
  if (!match && /^\d+$/.test(normalized)) {
    const amountLength = [4, 3, 2, 1].find((length) => normalized.length - length >= 3 && (normalized.length - length) % 3 === 0);
    if (amountLength) {
      const numberDigits = normalized.slice(0, -amountLength);
      const compactAmount = Number(normalized.slice(-amountLength));
      const numbers = numberDigits.match(/\d{3}/g) || [];
      if (compactAmount > 0 && numbers.length) return { numbers, amount: compactAmount, ruleType: numbers.length > 1 ? "compact_multi_direct" : "compact_direct" };
    }
  }
  if (!match && /^[\d/]+$/.test(normalized)) {
    const amountLength = [4, 3, 2, 1].find((length) => normalized.length - length >= 3 && (normalized.length - length) % 3 === 0);
    if (amountLength) {
      const compactAmount = Number(normalized.slice(-amountLength));
      if (compactAmount > 0) return expandRule(normalized.slice(0, -amountLength), compactAmount, false);
    }
  }
  if (!Number.isFinite(amount) || amount <= 0 || !rule) return null;
  return expandRule(rule, amount, permutation);
}

function parseLines(rawInput: string) {
  return rawInput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const parsedLine = parseRuleLine(line);
    return parsedLine ? [parsedLine] : line.split(/\s+/).filter(Boolean).map(parseRuleLine);
  });
}

function expandedItems(rawInput: string) {
  const parsed = parseLines(rawInput);
  if (parsed.some((item) => !item) || parsed.length === 0) return null;
  return parsed.filter((item): item is { numbers: string[]; amount: number; ruleType: string } => Boolean(item)).flatMap((item) => item.numbers.map((number) => ({ number, amount: item.amount, ruleType: item.ruleType })));
}

async function checkLimits(supabase: Awaited<ReturnType<typeof createClient>>, dealerId: string, commissionId: string, periodId: string, items: { number: string; amount: number }[], _totalAmount: number, excludeSaleId?: string) {
  const [{ data: overall }, { data: perNumber }, { data: commissionNumbers }] = await Promise.all([
    supabase.from("dealer_limits").select("max_amount, warning_percent").eq("dealer_id", dealerId).eq("draw_period_id", periodId).eq("limit_type", "all_number").is("number", null).limit(1).maybeSingle(),
    supabase.from("dealer_limits").select("number, max_amount, warning_percent").eq("dealer_id", dealerId).eq("draw_period_id", periodId).eq("limit_type", "number"),
    supabase.from("commission_number_limits").select("number, max_amount, warning_percent").eq("dealer_id", dealerId).eq("commission_id", commissionId).eq("draw_period_id", periodId),
  ]);
  const numbers = [...new Set(items.map((item) => item.number))];
  const { data: totals } = await supabase.rpc("get_limit_number_totals", { p_dealer_id: dealerId, p_draw_period_id: periodId, p_commission_id: commissionId, p_numbers: numbers, p_exclude_sale_id: excludeSaleId || null });
  const totalsByNumber = new Map<string, { dealer: number; commission: number }>(((totals || []) as { number: string; dealer_total: number; commission_total: number }[]).map((total) => [total.number, { dealer: Number(total.dealer_total), commission: Number(total.commission_total) }]));
  for (const number of numbers) {
    const commissionLimit = (commissionNumbers || []).find((limit) => limit.number === number);
    const globalLimit = (perNumber || []).find((limit) => limit.number === number);
    const limit = commissionLimit || globalLimit || overall;
    if (!limit) continue;
    const current = commissionLimit ? totalsByNumber.get(number)?.commission || 0 : totalsByNumber.get(number)?.dealer || 0;
    const added = items.filter((item) => item.number === number).reduce((sum, item) => sum + Number(item.amount), 0);
    const next = current + added;
    const max = Number(limit.max_amount);
    if (next > max) return `${number} limit ${max.toLocaleString()} ကျော်သွားပါမယ်။`;
    if (next >= max * Number(limit.warning_percent) / 100) return `${number} limit သတိပေးအဆင့် ရောက်နေပါပြီ။`;
  }
  return null;
}

export async function saveSales(_previous: SaveSalesState, formData: FormData): Promise<SaveSalesState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "အရင်ဆုံး login ဝင်ပါ။" };
  const commissionId = String(formData.get("commission_id") || "");
  const drawPeriodId = String(formData.get("draw_period_id") || "");
  const rawInput = String(formData.get("raw_input") || "").trim();
  if (!commissionId || !drawPeriodId || !rawInput) return { error: "ကော်မရှင်၊ အကြိမ်နဲ့ အရောင်းစာရင်း ဖြည့်ပါ။" };
  const items = expandedItems(rawInput);
  if (!items) return { error: "`123R100` သို့မဟုတ် `123.654R100` ပုံစံဖြင့် ရေးပါ။" };

  const { data: ownedDealer } = await supabase.from("dealers").select("id").eq("owner_user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  let dealerId = ownedDealer?.id;
  if (!dealerId) {
    const { data: membership } = await supabase.from("dealer_members").select("dealer_id").eq("user_id", user.id).limit(1).maybeSingle();
    dealerId = membership?.dealer_id;
  }
  if (!dealerId) return { error: "ဒီ account အတွက် ဒိုင် workspace မတွေ့ပါ။" };
  const { data: period } = await supabase.from("draw_periods").select("id, status").eq("id", drawPeriodId).eq("dealer_id", dealerId).maybeSingle();
  if (!period || period.status !== "open") return { error: "ရွေးထားတဲ့ အကြိမ်က ပိတ်ထားပြီးဖြစ်ပါတယ်။" };
  const { data: lastEntry } = await supabase.from("sales_entries").select("receipt_number").eq("dealer_id", dealerId).order("receipt_number", { ascending: false }).limit(1).maybeSingle();
  const receiptNumber = (lastEntry?.receipt_number ?? 0) + 1;
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const limitWarning = await checkLimits(supabase, dealerId, commissionId, drawPeriodId, items, totalAmount);
  const { data: entry, error: entryError } = await supabase.from("sales_entries").insert({ dealer_id: dealerId, commission_id: commissionId, draw_period_id: drawPeriodId, receipt_number: receiptNumber, raw_input: rawInput, total_amount: totalAmount, created_by: user.id }).select("id").single();
  if (entryError || !entry) return { error: entryError?.message || "စာရင်းသိမ်းမရပါ။" };
  const { error: itemError } = await supabase.from("sales_items").insert(items.map((item) => ({ sales_entry_id: entry.id, number: item.number, rule_type: item.ruleType, amount: item.amount, source_text: rawInput })));
  if (itemError) return { error: itemError.message };
  revalidatePath("/");
  return { success: `#${receiptNumber} စာရင်းသိမ်းပြီးပါပြီ။`, error: limitWarning ? `⚠️ ${limitWarning}` : undefined };
}

export async function updateSale(_previous: SaveSalesState, formData: FormData): Promise<SaveSalesState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const saleId = String(formData.get("sale_id") || "");
  const rawInput = String(formData.get("raw_input") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  if (!user || !saleId) return { error: "စာရင်းမတွေ့ပါ။" };
  if (!reason) return { error: "ပြင်ဆင်ရတဲ့အကြောင်းပြချက် ထည့်ပါ။" };
  const items = expandedItems(rawInput);
  if (!items) return { error: "`123R100` သို့မဟုတ် `123.654R100` ပုံစံဖြင့် ရေးပါ။" };
  const { data: oldSale } = await supabase.from("sales_entries").select("id, dealer_id, commission_id, draw_period_id, raw_input, total_amount, status").eq("id", saleId).maybeSingle();
  if (!oldSale || oldSale.status === "deleted") return { error: "ဒီစာရင်းကို ပြင်လို့မရပါ။" };
  const { data: oldItems } = await supabase.from("sales_items").select("number, rule_type, amount, source_text").eq("sales_entry_id", saleId);
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const { data: period } = await supabase.from("draw_periods").select("status").eq("id", oldSale.draw_period_id).eq("dealer_id", oldSale.dealer_id).maybeSingle();
  if (!period || period.status !== "open") return { error: "ပိတ်ပြီးသားအကြိမ်ထဲက စာရင်းကို ပြင်လို့မရပါ။" };
  const limitWarning = await checkLimits(supabase, oldSale.dealer_id, oldSale.commission_id, oldSale.draw_period_id, items, totalAmount, saleId);
  const { error: updateError } = await supabase.from("sales_entries").update({ raw_input: rawInput, total_amount: totalAmount, updated_by: user.id }).eq("id", saleId);
  if (updateError) return { error: updateError.message };
  await supabase.from("sales_items").delete().eq("sales_entry_id", saleId);
  const { error: itemError } = await supabase.from("sales_items").insert(items.map((item) => ({ sales_entry_id: saleId, number: item.number, rule_type: item.ruleType, amount: item.amount, source_text: rawInput })));
  if (itemError) return { error: itemError.message };
  await supabase.from("audit_logs").insert({ dealer_id: oldSale.dealer_id, entity_type: "sales_entry", entity_id: saleId, action: "update", old_data: { ...oldSale, items: oldItems || [] }, new_data: { ...oldSale, raw_input: rawInput, total_amount: totalAmount, items }, reason, created_by: user.id });
  revalidatePath("/");
  return { success: "စာရင်းပြင်ပြီးပါပြီ။", error: limitWarning ? `⚠️ ${limitWarning}` : undefined };
}

export async function deleteSale(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const saleId = String(formData.get("sale_id") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!user || !saleId) return;
  if (!reason) return;
  const { data: sale } = await supabase.from("sales_entries").select("id, dealer_id, commission_id, draw_period_id, status, raw_input, total_amount").eq("id", saleId).maybeSingle();
  if (!sale || sale.status === "deleted") return;
  const { data: period } = await supabase.from("draw_periods").select("status").eq("id", sale.draw_period_id).eq("dealer_id", sale.dealer_id).maybeSingle();
  if (!period || period.status !== "open") return;
  const { error } = await supabase.from("sales_entries").update({ status: "deleted", deleted_at: new Date().toISOString(), deleted_by: user.id, updated_by: user.id }).eq("id", saleId);
  if (error) return;
  await supabase.from("audit_logs").insert({ dealer_id: sale.dealer_id, entity_type: "sales_entry", entity_id: sale.id, action: "delete", old_data: sale, new_data: { ...sale, status: "deleted" }, reason, created_by: user.id });
  revalidatePath("/");
}
