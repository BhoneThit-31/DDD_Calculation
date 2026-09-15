import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-end justify-between border-b border-slate-200 pb-5">
          <div>
            <p className="mb-2 text-sm text-blue-700">DDD Calculation</p>
            <h1 className="text-3xl font-bold tracking-tight">သုံးလုံး အရောင်း POS</h1>
            <p className="mt-2 text-slate-500">ဒိုင်အတွက် ရောင်းစာရင်း စီမံခန့်ခွဲမှုစနစ်</p>
          </div>
          <span className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
            အခြေခံစနစ် ပြင်ဆင်နေဆဲ
          </span>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["ဒိုင်များ", "ဒိုင်တစ်ယောက်စီ သီးခြား workspace"],
            ["ကော်မရှင်များ", "ကိုယ်ပိုင် ကော်မရှင်လူများ"],
            ["အကြိမ်များ", "ရက်စွဲအပိုင်းအခြားအလိုက် သုံးလုံး"],
          ].map(([title, description]) => (
            <div key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-slate-500">{description}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">စတင်ရန် အဆင့်များ</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600">
            <li>ဒိုင်အကောင့် ဖန်တီးမည်</li>
            <li>ကော်မရှင်လူများ ထည့်မည်</li>
            <li>သုံးလုံးအကြိမ် ရက်စွဲသတ်မှတ်မည်</li>
            <li>ရောင်းစာရင်းနှင့် စည်းမျဉ်းများ ဆက်တည်ဆောက်မည်</li>
          </ol>
        </div>
      </section>
    </main>
  );
}
