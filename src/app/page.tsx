import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SalesEntry from "@/app/sales-entry";
import Setup from "@/app/setup";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: owned } = await supabase.from("dealers").select("id, shop_name").eq("owner_user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  let dealerId = owned?.id;
  if (!dealerId) {
    const { data: membership } = await supabase.from("dealer_members").select("dealer_id").eq("user_id", user.id).limit(1).maybeSingle();
    dealerId = membership?.dealer_id;
  }
  if (!dealerId) return <main className="min-h-screen bg-slate-100 p-6"><section className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900"><h1 className="font-bold">ဒိုင် workspace မရှိသေးပါ</h1><p className="mt-2 text-sm">ဒီ account ကို dealer တစ်ခုနဲ့ ချိတ်ပြီးမှ အရောင်းစာရင်းထည့်နိုင်ပါမယ်။</p></section></main>;
  const [{ data: commissions }, { data: periods }, { data: sales }] = await Promise.all([
    supabase.from("commissions").select("id, name").eq("dealer_id", dealerId).eq("status", "active").order("created_at"),
    supabase.from("draw_periods").select("id, name").eq("dealer_id", dealerId).eq("status", "open").order("start_date", { ascending: false }),
    supabase.from("sales_entries").select("id, receipt_number, raw_input, total_amount, created_at").eq("dealer_id", dealerId).eq("status", "active").order("created_at", { ascending: false }).limit(30),
  ]);
  const entryIds = (sales || []).map((sale) => sale.id);
  const { data: items } = entryIds.length ? await supabase.from("sales_items").select("sales_entry_id, number, amount, rule_type").in("sales_entry_id", entryIds) : { data: [] };
  const numberTotals = (items || []).reduce<Record<string, number>>((totals, item) => { totals[item.number] = (totals[item.number] || 0) + Number(item.amount); return totals; }, {});
  const itemsByEntry = (items || []).reduce<Record<string, { number: string; amount: number; rule_type: string }[]>>((grouped, item) => { (grouped[item.sales_entry_id] ||= []).push({ number: item.number, amount: Number(item.amount), rule_type: item.rule_type }); return grouped; }, {});
  const salesWithItems = (sales || []).map((sale) => ({ ...sale, items: itemsByEntry[sale.id] || [] }));
  return <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6"><section className="mx-auto max-w-7xl"><header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5"><div><p className="text-sm font-medium text-blue-700">DDD Calculation</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">သုံးလုံး အရောင်း POS</h1><p className="mt-1 text-sm text-slate-500">{owned?.shop_name || "ဒိုင်အရောင်းစာရင်း စီမံခန့်ခွဲမှု"}</p></div><div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Supabase ချိတ်ဆက်ပြီး</div></header><Setup showCommission={!commissions?.length} showPeriod={!periods?.length} /><SalesEntry commissions={commissions || []} periods={periods || []} sales={salesWithItems} numberTotals={numberTotals} /></section></main>;
}
