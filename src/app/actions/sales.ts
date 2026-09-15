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

function expandedItems(rawInput: string) {
  const parsed = parseLines(rawInput);
  if (parsed.some((item) => !item) || parsed.length === 0) return null;
  return parsed.filter((item): item is { numbers: string[]; amount: number; ruleType: string } => Boolean(item)).flatMap((item) => item.numbers.map((number) => ({ number, amount: item.amount, ruleType: item.ruleType })));
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
  if (!items) return { error: "တစ်ကြောင်းစီ `ဂဏန်း ပမာဏ` ပုံစံရေးပါ။ ဥပမာ - 123 100" };

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

export async function updateSale(_previous: SaveSalesState, formData: FormData): Promise<SaveSalesState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const saleId = String(formData.get("sale_id") || "");
  const rawInput = String(formData.get("raw_input") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  if (!user || !saleId) return { error: "စာရင်းမတွေ့ပါ။" };
  if (!reason) return { error: "ပြင်ဆင်ရတဲ့အကြောင်းပြချက် ထည့်ပါ။" };
  const items = expandedItems(rawInput);
  if (!items) return { error: "တစ်ကြောင်းစီ `ဂဏန်း ပမာဏ` ပုံစံရေးပါ။" };
  const { data: oldSale } = await supabase.from("sales_entries").select("id, dealer_id, commission_id, draw_period_id, raw_input, total_amount, status").eq("id", saleId).maybeSingle();
  if (!oldSale || oldSale.status === "deleted") return { error: "ဒီစာရင်းကို ပြင်လို့မရပါ။" };
  const { data: oldItems } = await supabase.from("sales_items").select("number, rule_type, amount, source_text").eq("sales_entry_id", saleId);
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const { error: updateError } = await supabase.from("sales_entries").update({ raw_input: rawInput, total_amount: totalAmount, updated_by: user.id }).eq("id", saleId);
  if (updateError) return { error: updateError.message };
  await supabase.from("sales_items").delete().eq("sales_entry_id", saleId);
  const { error: itemError } = await supabase.from("sales_items").insert(items.map((item) => ({ sales_entry_id: saleId, number: item.number, rule_type: item.ruleType, amount: item.amount, source_text: rawInput })));
  if (itemError) return { error: itemError.message };
  await supabase.from("audit_logs").insert({ dealer_id: oldSale.dealer_id, entity_type: "sales_entry", entity_id: saleId, action: "update", old_data: { ...oldSale, items: oldItems || [] }, new_data: { ...oldSale, raw_input: rawInput, total_amount: totalAmount, items }, reason, created_by: user.id });
  revalidatePath("/");
  return { success: "စာရင်းပြင်ပြီးပါပြီ။" };
}

export async function deleteSale(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const saleId = String(formData.get("sale_id") || "");
  const reason = String(formData.get("reason") || "").trim();
  if (!user || !saleId) return;
  if (!reason) return;
  const { data: sale } = await supabase.from("sales_entries").select("id, dealer_id, status, raw_input, total_amount").eq("id", saleId).maybeSingle();
  if (!sale || sale.status === "deleted") return;
  const { error } = await supabase.from("sales_entries").update({ status: "deleted", deleted_at: new Date().toISOString(), deleted_by: user.id, updated_by: user.id }).eq("id", saleId);
  if (error) return;
  await supabase.from("audit_logs").insert({ dealer_id: sale.dealer_id, entity_type: "sales_entry", entity_id: sale.id, action: "delete", old_data: sale, new_data: { ...sale, status: "deleted" }, reason, created_by: user.id });
  revalidatePath("/");
}
