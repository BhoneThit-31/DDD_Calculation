"use client";

import Link from "next/link";
import { useState } from "react";

type FilterValues = { search: string; from: string; to: string; commission: string; period: string; status: string; sort: string; dir: string };

export default function SalesFilters({ values }: { values: FilterValues }) {
  const [open, setOpen] = useState(false);
  return <>
    <div className="mt-6 border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-semibold">အရောင်းစာရင်း</h3><p className="mt-1 text-xs text-slate-500">လက်ရှိရွေးထားသော ကော်မရှင်နှင့် အကြိမ်စာရင်း</p></div><div className="flex flex-wrap items-end gap-2"><form method="get" action="/" className="flex items-end gap-2"><input type="hidden" name="commission" value={values.commission} /><input type="hidden" name="period" value={values.period} /><input type="hidden" name="sort" value={values.sort} /><input type="hidden" name="dir" value={values.dir} /><label className="text-xs text-slate-500"><span className="sr-only">စာရင်းနံပါတ်ရှာရန်</span><input name="search" inputMode="numeric" pattern="[0-9]*" defaultValue={values.search} placeholder="စာရင်းနံပါတ်ရှာရန်" className="h-9 w-40 rounded-lg border border-slate-300 px-3 text-sm" /></label><button type="submit" aria-label="ရှာမည်" className="h-9 rounded-lg bg-blue-700 px-3 text-sm font-medium text-white hover:bg-blue-800">ရှာ</button></form><button type="button" onClick={() => setOpen(true)} className="h-9 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100">စီရန်</button></div></div>
    </div>
    {open && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-label="အရောင်းစာရင်းရှာရန်">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">အရောင်းစာရင်းရှာရန်</h2><p className="mt-1 text-xs text-slate-500">အပေါ်မှာရွေးထားတဲ့ စာရင်းအတွင်း sorting လုပ်ရန်</p></div><button type="button" onClick={() => setOpen(false)} aria-label="ပိတ်မည်" className="h-8 w-8 rounded-md border border-slate-200 text-lg text-slate-500 hover:bg-slate-50">×</button></div>
        <form method="get" action="/" className="mt-5 space-y-4">
          <input type="hidden" name="commission" value={values.commission} /><input type="hidden" name="period" value={values.period} />
          <label className="block text-sm text-slate-600">စီရန်<select name="sort" defaultValue={values.sort} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="amount">ငွေပမာဏအလိုက်</option><option value="time">ထည့်သွင်းချိန်အလိုက်</option><option value="list">စာရင်းနံပါတ်အလိုက်</option></select></label>
          <label className="block text-sm text-slate-600">အစီအစဉ်<select name="dir" defaultValue={values.dir} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="desc">ကြီးစဉ်ငယ်လိုက်</option><option value="asc">ငယ်စဉ်ကြီးလိုက်</option></select></label>
          <div className="flex justify-end gap-2"><Link href={`/?${new URLSearchParams({ commission: values.commission, period: values.period }).toString()}`} onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">မူလအတိုင်း</Link><button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">ပြမည်</button></div>
        </form>
      </div>
    </div>}
  </>;
}
