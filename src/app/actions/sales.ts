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

function parseRuleLine(line: string) {
  const normalized = toEnglishDigits(line).replace(/,/g, "").replace(/\s+/g, "").toUpperCase();
  const amountMatch = normalized.match(/(\d+(?:\.\d+)?)$/);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1]);
  const rule = normalized.slice(0, -amountMatch[1].length);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (/^A$/.test(rule)) {
    return { numbers: Array.from({ length: 10 }, (_, digit) => `${digit}${digit}${digit}`), amount, ruleType: "all_same" };
  }
  if (/^\d{1,3}R$/.test(rule)) {
    return { numbers: uniquePermutations(rule.slice(0, -1)).map((number) => number.padStart(3, "0")), amount, ruleType: "permutation" };
  }
  if (/^\d{1,3}$/.test(rule)) {
    return { numbers: [rule.padStart(3, "0")], amount, ruleType: "direct" };
  }
  return null;
}

function parseLines(rawInput: string) {
  return rawInput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map(parseRuleLine);
}

export async function saveSales(_previous: SaveSalesState, formData: FormData): Promise<SaveSalesState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "အရင်ဆုံး login ဝင်ပါ။" };
  const commissionId = String(formData.get("commission_id") || "");
  const drawPeriodId = String(formData.get("draw_period_id") || "");
  const rawInput = String(formData.get("raw_input") || "").trim();
  if (!commissionId || !drawPeriodId || !rawInput) return { error: "ကော်မရှင်၊ အကြိမ်နဲ့ အရောင်းစာရင်း ဖြည့်ပါ။" };
  const parsed = parseLines(rawInput);
  if (parsed.some((item) => !item) || parsed.length === 0) return { error: "တစ်ကြောင်းစီ `ဂဏန်း ပမာဏ` ပုံစံရေးပါ။ ဥပမာ - 123 100" };
  const items = parsed.filter((item): item is { numbers: string[]; amount: number; ruleType: string } => Boolean(item)).flatMap((item) => item.numbers.map((number) => ({ number, amount: item.amount, ruleType: item.ruleType })));

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
  const { data: entry, error: entryError } = await supabase.from("sales_entries").insert({ dealer_id: dealerId, commission_id: commissionId, draw_period_id: drawPeriodId, receipt_number: receiptNumber, raw_input: rawInput, total_amount: totalAmount, created_by: user.id }).select("id").single();
  if (entryError || !entry) return { error: entryError?.message || "စာရင်းသိမ်းမရပါ။" };
  const { error: itemError } = await supabase.from("sales_items").insert(items.map((item) => ({ sales_entry_id: entry.id, number: item.number, rule_type: item.ruleType, amount: item.amount, source_text: rawInput })));
  if (itemError) return { error: itemError.message };
  revalidatePath("/");
  return { success: `#${receiptNumber} စာရင်းသိမ်းပြီးပါပြီ။` };
}
