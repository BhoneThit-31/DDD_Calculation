import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SalesEntry from "@/app/sales-entry";
import Setup from "@/app/setup";

type SearchParams = { page?: string; search?: string; from?: string; to?: string; commission?: string; period?: string; status?: string; sort?: string; dir?: string };
const pageSize = 10;

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: owned } = await supabase.from("dealers").select("id, shop_name").eq("owner_user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  let dealerId = owned?.id;
  if (!dealerId) { const { data: membership } = await supabase.from("dealer_members").select("dealer_id").eq("user_id", user.id).limit(1).maybeSingle(); dealerId = membership?.dealer_id; }
  if (!dealerId) return <main className="min-h-screen bg-slate-100 p-6"><section className="mx-auto max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900"><h1 className="font-bold">ဒိုင် workspace မရှိသေးပါ</h1><p className="mt-2 text-sm">ဒီ account ကို dealer တစ်ခုနဲ့ ချိတ်ပြီးမှ အရောင်းစာရင်းထည့်နိုင်ပါမယ်။</p></section></main>;
  const params = await searchParams;
  const [{ data: commissions }, { data: allPeriods }] = await Promise.all([
    supabase.from("commissions").select("id, name").eq("dealer_id", dealerId).eq("status", "active").order("created_at"),
    supabase.from("draw_periods").select("id, name, status").eq("dealer_id", dealerId).order("start_date", { ascending: false }),
  ]);
  const openPeriods = (allPeriods || []).filter((period) => period.status === "open");
  const requestedPage = Math.max(1, Number(params.page) || 1);
  const status = params.status === "deleted" || params.status === "all" ? params.status : "active";
  const sort = params.sort === "list" || params.sort === "amount" ? params.sort : "time";
  const ascending = params.dir === "asc";
  const orderColumn = sort === "list" ? "receipt_number" : sort === "amount" ? "total_amount" : "created_at";
  let query = supabase.from("sales_entries").select("id, receipt_number, raw_input, total_amount, created_at, status", { count: "exact" }).eq("dealer_id", dealerId);
  if (status !== "all") query = query.eq("status", status);
  if (params.search?.trim()) { const listNumber = Number(params.search.trim()); query = /^\d+$/.test(params.search.trim()) ? query.eq("receipt_number", listNumber) : query.eq("receipt_number", -1); }
  if (params.commission) query = query.eq("commission_id", params.commission);
  const selectedCommission = params.commission || commissions?.[0]?.id;
  const selectedPeriod = params.period || openPeriods[0]?.id;
  if (selectedCommission) query = query.eq("commission_id", selectedCommission);
  if (selectedPeriod) query = query.eq("draw_period_id", selectedPeriod);
  if (params.from) query = query.gte("created_at", `${params.from}T00:00:00+06:30`);
  if (params.to) query = query.lte("created_at", `${params.to}T23:59:59+06:30`);
  let summaryQuery = supabase.from("sales_entries").select("total_amount").eq("dealer_id", dealerId);
  if (status !== "all") summaryQuery = summaryQuery.eq("status", status);
  if (params.search?.trim()) { const listNumber = Number(params.search.trim()); summaryQuery = /^\d+$/.test(params.search.trim()) ? summaryQuery.eq("receipt_number", listNumber) : summaryQuery.eq("receipt_number", -1); }
  if (selectedCommission) summaryQuery = summaryQuery.eq("commission_id", selectedCommission);
  if (selectedPeriod) summaryQuery = summaryQuery.eq("draw_period_id", selectedPeriod);
  if (params.from) summaryQuery = summaryQuery.gte("created_at", `${params.from}T00:00:00+06:30`);
  if (params.to) summaryQuery = summaryQuery.lte("created_at", `${params.to}T23:59:59+06:30`);
  const { data: summaryRows } = await summaryQuery;
  const summaryTotal = (summaryRows || []).reduce((sum, sale) => sum + Number(sale.total_amount), 0);
  const { data: sales, count } = await query.order(orderColumn, { ascending }).range((requestedPage - 1) * pageSize, requestedPage * pageSize - 1);
  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const entryIds = (sales || []).map((sale) => sale.id);
  const { data: items } = entryIds.length ? await supabase.from("sales_items").select("sales_entry_id, number, amount, rule_type").in("sales_entry_id", entryIds) : { data: [] };
  const numberTotals = (items || []).reduce<Record<string, number>>((totals, item) => { totals[item.number] = (totals[item.number] || 0) + Number(item.amount); return totals; }, {});
  const itemsByEntry = (items || []).reduce<Record<string, { number: string; amount: number; rule_type: string }[]>>((grouped, item) => { (grouped[item.sales_entry_id] ||= []).push({ number: item.number, amount: Number(item.amount), rule_type: item.rule_type }); return grouped; }, {});
  const salesWithItems = (sales || []).map((sale) => ({ ...sale, items: itemsByEntry[sale.id] || [] }));
  const filterValues = { search: params.search || "", from: params.from || "", to: params.to || "", commission: selectedCommission || "", period: selectedPeriod || "", status, sort, dir: ascending ? "asc" : "desc" };
  const queryValues = Object.fromEntries(Object.entries(filterValues).filter(([, value]) => value)) as Record<string, string>;
  return <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6"><section className="mx-auto max-w-7xl"><header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5"><div><p className="text-sm font-medium text-blue-700">DDD Calculation</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">သုံးလုံး အရောင်း POS</h1><p className="mt-1 text-sm text-slate-500">{owned?.shop_name || "ဒိုင်အရောင်းစာရင်း စီမံခန့်ခွဲမှု"}</p></div></header><Setup showCommission={!commissions?.length} showPeriod={!openPeriods.length} /><SalesEntry commissions={commissions || []} periods={openPeriods} sales={salesWithItems} numberTotals={numberTotals} summaryTotal={summaryTotal} filterValues={filterValues} pagination={{ page: currentPage, totalPages, total: count || 0, pageSize }} query={queryValues} /></section></main>;
}
