import Link from "next/link";

export default function Pagination({ page, totalPages, total, pageSize, query }: { page: number; totalPages: number; total: number; pageSize: number; query: Record<string, string> }) {
  const href = (nextPage: number) => `/?${new URLSearchParams({ ...query, page: String(nextPage) }).toString()}`;
  return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"><span className="text-slate-500">စုစုပေါင်း {total.toLocaleString("en-US")} ကြောင်း · စာမျက်နှာ {page} / {totalPages}</span><div className="flex gap-2"><Link aria-disabled={page <= 1} className={`rounded-md border px-3 py-1.5 ${page <= 1 ? "pointer-events-none text-slate-300" : "text-blue-700 hover:bg-blue-50"}`} href={href(Math.max(1, page - 1))}>‹ အရင်</Link><Link aria-disabled={page >= totalPages} className={`rounded-md border px-3 py-1.5 ${page >= totalPages ? "pointer-events-none text-slate-300" : "text-blue-700 hover:bg-blue-50"}`} href={href(Math.min(totalPages, page + 1))}>နောက် ›</Link></div><span className="text-xs text-slate-400">တစ်မျက်နှာ {pageSize} ကြောင်း</span></div>;
}
