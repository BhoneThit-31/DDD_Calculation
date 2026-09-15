"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SetupState = { error?: string; success?: string };

async function getDealerId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, dealerId: null };
  const { data: owned } = await supabase.from("dealers").select("id").eq("owner_user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (owned?.id) return { supabase, user, dealerId: owned.id };
  const { data: membership } = await supabase.from("dealer_members").select("dealer_id").eq("user_id", user.id).limit(1).maybeSingle();
  return { supabase, user, dealerId: membership?.dealer_id || null };
}

export async function createCommission(_previous: SetupState, formData: FormData): Promise<SetupState> {
  const { supabase, dealerId } = await getDealerId();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const commissionPercent = Number(formData.get("commission_percent") || 0);
  const payoutRate = Number(formData.get("default_payout_rate") || 80);
  if (!dealerId) return { error: "ဒိုင် workspace မတွေ့ပါ။" };
  if (!name) return { error: "ကော်မရှင်လူအမည် ထည့်ပါ။" };
  if (commissionPercent < 0 || commissionPercent > 100 || payoutRate < 0) return { error: "နှုန်းထားကို မှန်ကန်စွာ ထည့်ပါ။" };
  const { error } = await supabase.from("commissions").insert({ dealer_id: dealerId, name, phone: phone || null, commission_percent: commissionPercent, default_payout_rate: payoutRate });
  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: "ကော်မရှင်လူ ထည့်ပြီးပါပြီ။" };
}

export async function updateCommission(_previous: SetupState, formData: FormData): Promise<SetupState> {
  const { supabase, dealerId } = await getDealerId();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const commissionPercent = Number(formData.get("commission_percent") || 0);
  const payoutRate = Number(formData.get("default_payout_rate") || 80);
  if (!dealerId || !id || !name) return { error: "ကော်မရှင်လူအချက်အလက် မပြည့်စုံပါ။" };
  if (commissionPercent < 0 || commissionPercent > 100 || payoutRate < 0) return { error: "နှုန်းထားကို မှန်ကန်စွာ ထည့်ပါ။" };
  const { error } = await supabase.from("commissions").update({ name, phone: phone || null, commission_percent: commissionPercent, default_payout_rate: payoutRate, updated_at: new Date().toISOString() }).eq("id", id).eq("dealer_id", dealerId);
  if (error) return { error: error.message };
  revalidatePath("/settings"); revalidatePath("/");
  return { success: "ကော်မရှင်လူ ပြင်ပြီးပါပြီ။" };
}

export async function toggleCommission(_previous: SetupState, formData: FormData): Promise<SetupState> {
  const { supabase, dealerId } = await getDealerId();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "inactive") === "active" ? "active" : "inactive";
  if (!dealerId || !id) return { error: "ကော်မရှင်လူ မတွေ့ပါ။" };
  const { error } = await supabase.from("commissions").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("dealer_id", dealerId);
  if (error) return { error: error.message };
  revalidatePath("/settings"); revalidatePath("/");
  return { success: status === "active" ? "ပြန်ဖွင့်ပြီးပါပြီ။" : "အလုပ်မလုပ်အောင် ပိတ်ပြီးပါပြီ။" };
}

export async function createDrawPeriod(_previous: SetupState, formData: FormData): Promise<SetupState> {
  const { supabase, dealerId } = await getDealerId();
  const name = String(formData.get("name") || "").trim();
  const startDate = String(formData.get("start_date") || "");
  const endDate = String(formData.get("end_date") || "");
  const drawDate = String(formData.get("draw_date") || "");
  if (!dealerId) return { error: "ဒိုင် workspace မတွေ့ပါ။" };
  if (!name || !startDate || !endDate || !drawDate) return { error: "အကြိမ်အမည်နဲ့ ရက်စွဲအားလုံး ဖြည့်ပါ။" };
  if (startDate > endDate || drawDate < startDate || drawDate > endDate) return { error: "ရက်စွဲအပိုင်းအခြား မမှန်ပါ။" };
  const { error } = await supabase.from("draw_periods").insert({ dealer_id: dealerId, name, start_date: startDate, end_date: endDate, draw_date: drawDate });
  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: "အကြိမ် ထည့်ပြီးပါပြီ။" };
}

export async function setDrawPeriodStatus(_previous: SetupState, formData: FormData): Promise<SetupState> {
  const { supabase, user, dealerId } = await getDealerId();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "open");
  if (!user || !dealerId || !id || !["open", "closed"].includes(status)) return { error: "အကြိမ်အချက်အလက် မမှန်ပါ။" };
  const { data: period } = await supabase.from("draw_periods").select("id, status").eq("id", id).eq("dealer_id", dealerId).maybeSingle();
  if (!period) return { error: "အကြိမ် မတွေ့ပါ။" };
  const { error } = await supabase.from("draw_periods").update({ status, locked_at: status === "closed" ? new Date().toISOString() : null, locked_by: status === "closed" ? user.id : null, updated_at: new Date().toISOString() }).eq("id", id).eq("dealer_id", dealerId);
  if (error) return { error: error.message };
  revalidatePath("/settings"); revalidatePath("/");
  return { success: status === "closed" ? "အကြိမ်ပိတ်ပြီးပါပြီ။" : "အကြိမ်ပြန်ဖွင့်ပြီးပါပြီ။" };
}

export async function saveCommissionLimit(_previous: SetupState, formData: FormData): Promise<SetupState> {
  const { supabase, dealerId } = await getDealerId();
  const periodId = String(formData.get("draw_period_id") || "");
  const maxAmount = Number(formData.get("max_amount") || 0);
  const warningPercent = Number(formData.get("warning_percent") || 80);
  if (!dealerId || !periodId || maxAmount < 0 || warningPercent < 0 || warningPercent > 100) return { error: "Global limit အချက်အလက် မမှန်ပါ။" };
  const { error } = await supabase.from("dealer_limits").upsert({ dealer_id: dealerId, draw_period_id: periodId, limit_type: "all_number", number: null, max_amount: maxAmount, warning_percent: warningPercent, updated_at: new Date().toISOString() }, { onConflict: "dealer_id,draw_period_id,limit_type,number" });
  if (error) return { error: error.message };
  revalidatePath("/settings"); revalidatePath("/");
  return { success: "စုစုပေါင်း limit သိမ်းပြီးပါပြီ။" };
}

export async function saveNumberLimit(_previous: SetupState, formData: FormData): Promise<SetupState> {
  const { supabase, dealerId } = await getDealerId();
  const periodId = String(formData.get("draw_period_id") || "");
  const number = String(formData.get("number") || "").replace(/[^0-9]/g, "").padStart(3, "0");
  const maxAmount = Number(formData.get("max_amount") || 0);
  const warningPercent = Number(formData.get("warning_percent") || 80);
  if (!dealerId || !periodId || !/^\d{3}$/.test(number) || maxAmount < 0 || warningPercent < 0 || warningPercent > 100) return { error: "Global ဂဏန်း limit အချက်အလက် မမှန်ပါ။" };
  const { error } = await supabase.from("dealer_limits").upsert({ dealer_id: dealerId, draw_period_id: periodId, limit_type: "number", number, max_amount: maxAmount, warning_percent: warningPercent, updated_at: new Date().toISOString() }, { onConflict: "dealer_id,draw_period_id,limit_type,number" });
  if (error) return { error: error.message };
  revalidatePath("/settings"); revalidatePath("/");
  return { success: `${number} limit သိမ်းပြီးပါပြီ။` };
}

export async function saveCommissionNumberLimit(_previous: SetupState, formData: FormData): Promise<SetupState> {
  const { supabase, dealerId } = await getDealerId();
  const commissionId = String(formData.get("commission_id") || "");
  const periodId = String(formData.get("draw_period_id") || "");
  const number = String(formData.get("number") || "").replace(/[^0-9]/g, "").padStart(3, "0");
  const maxAmount = Number(formData.get("max_amount") || 0);
  const warningPercent = Number(formData.get("warning_percent") || 100);
  if (!dealerId || !commissionId || !periodId || !/^\d{3}$/.test(number) || maxAmount < 0 || warningPercent < 0 || warningPercent > 100) return { error: "Commission number limit အချက်အလက် မမှန်ပါ။" };
  const { error } = await supabase.from("commission_number_limits").upsert({ dealer_id: dealerId, commission_id: commissionId, draw_period_id: periodId, number, max_amount: maxAmount, warning_percent: warningPercent, updated_at: new Date().toISOString() }, { onConflict: "commission_id,draw_period_id,number" });
  if (error) return { error: error.message };
  revalidatePath("/settings"); revalidatePath("/");
  return { success: `${number} commission limit သိမ်းပြီးပါပြီ။` };
}

export async function saveWinningResult(_previous: SetupState, formData: FormData): Promise<SetupState> {
  const { supabase, user, dealerId } = await getDealerId();
  const periodId = String(formData.get("draw_period_id") || "");
  const winningNumber = String(formData.get("winning_number") || "").replace(/[^0-9]/g, "").padStart(3, "0");
  if (!user || !dealerId || !periodId) return { error: "ဒိုင် workspace သို့မဟုတ် အကြိမ် မတွေ့ပါ။" };
  if (!/^\d{3}$/.test(winningNumber)) return { error: "ပေါက်ဂဏန်းကို ၃ လုံးဖြည့်ပါ။" };
  const { data: period } = await supabase.from("draw_periods").select("id, status").eq("id", periodId).eq("dealer_id", dealerId).maybeSingle();
  if (!period) return { error: "ရွေးထားတဲ့ အကြိမ် မတွေ့ပါ။" };
  const { error } = await supabase.from("winning_results").upsert({ draw_period_id: periodId, winning_number: winningNumber, created_by: user.id, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "draw_period_id" });
  if (error) return { error: error.message };
  revalidatePath("/");
  return { success: `ပေါက်ဂဏန်း ${winningNumber} သိမ်းပြီးပါပြီ။` };
}
