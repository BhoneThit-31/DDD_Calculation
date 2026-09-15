"use client";

import { useActionState } from "react";
import { saveWinningResult } from "@/app/actions/setup";

const money = (value: number) => value.toLocaleString("en-US");

export default function WinningResult({ periodId, winningNumber, winningStake, winningPayout, payoutRate }: { periodId?: string; winningNumber?: string; winningStake: number; winningPayout: number; payoutRate: number }) {
  const [state, action, pending] = useActionState(saveWinningResult, {});
  return <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-bold text-amber-950">ပေါက်ဂဏန်း</h2><p className="mt-1 text-xs text-amber-800">ရွေးထားတဲ့ အကြိမ်အတွက် တစ်ခုတည်းထည့်ပါ</p></div>{winningNumber && <span className="rounded-lg bg-red-600 px-3 py-1.5 text-lg font-bold tracking-widest text-white">{winningNumber}</span>}</div><form action={action} className="mt-3 flex gap-2"><input type="hidden" name="draw_period_id" value={periodId || ""} /><input name="winning_number" inputMode="numeric" maxLength={3} defaultValue={winningNumber || ""} placeholder="000" className="h-10 min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-3 text-center text-lg font-semibold tracking-widest" /><button disabled={!periodId || pending} className="h-10 rounded-lg bg-amber-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300">{pending ? "သိမ်းနေသည်…" : winningNumber ? "ပြင်မည်" : "သိမ်းမည်"}</button></form>{winningNumber && <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-white/70 p-2"><span className="text-amber-800">ပေါက်ရောင်းအား</span><b className="mt-1 block text-sm text-slate-900">{money(winningStake)}</b></div><div className="rounded-lg bg-white/70 p-2"><span className="text-amber-800">ပေါက်ငွေ ({payoutRate}x)</span><b className="mt-1 block text-sm text-red-700">{money(winningPayout)}</b></div></div>}{state.error && <p className="mt-2 text-xs text-red-700">{state.error}</p>}{state.success && <p className="mt-2 text-xs text-emerald-700">{state.success}</p>}</section>;
}
