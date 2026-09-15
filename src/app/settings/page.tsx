import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: owned } = await supabase.from("dealers").select("id, shop_name").eq("owner_user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  let dealerId = owned?.id;
  if (!dealerId) { const { data } = await supabase.from("dealer_members").select("dealer_id").eq("user_id", user.id).limit(1).maybeSingle(); dealerId = data?.dealer_id; }
  if (!dealerId) redirect("/");
  const [{ data: commissions }, { data: periods }] = await Promise.all([
    supabase.from("commissions").select("id, name, phone, commission_percent, default_payout_rate, status").eq("dealer_id", dealerId).order("created_at"),
    supabase.from("draw_periods").select("id, name, start_date, end_date, draw_date, status").eq("dealer_id", dealerId).order("start_date", { ascending: false }),
  ]);
  const commissionIds = (commissions || []).map((item: { id: string }) => item.id);
  const [{ data: commissionLimits }, { data: numberLimits }, { data: commissionNumberLimits }] = await Promise.all([
    supabase.from("dealer_limits").select("id, dealer_id, draw_period_id, number, max_amount, warning_percent").eq("dealer_id", dealerId).eq("limit_type", "all_number"),
    supabase.from("dealer_limits").select("id, dealer_id, draw_period_id, number, max_amount, warning_percent").eq("dealer_id", dealerId).eq("limit_type", "number"),
    supabase.from("commission_number_limits").select("id, commission_id, draw_period_id, number, max_amount, warning_percent").eq("dealer_id", dealerId),
  ]);
  return <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6"><section className="mx-auto max-w-6xl"><header className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4"><div><p className="text-sm font-medium text-blue-700">DDD Calculation</p><h1 className="text-2xl font-bold">စီမံခန့်ခွဲမှု</h1><p className="text-sm text-slate-500">{owned?.shop_name || "Workspace settings"}</p></div><Link href="/" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold">အရောင်းစာရင်းသို့</Link></header><SettingsClient commissions={commissions || []} periods={periods || []} commissionLimits={commissionLimits || []} numberLimits={numberLimits || []} commissionNumberLimits={commissionNumberLimits || []} /></section></main>;
}
