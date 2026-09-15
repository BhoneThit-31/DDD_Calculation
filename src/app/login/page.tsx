"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { data: phoneData, error: lookupError } = await supabase.rpc(
      "resolve_login_phone",
      { identifier },
    );

    if (lookupError || !phoneData) {
      setError("ဖုန်းနံပါတ် သို့မဟုတ် အသုံးပြုသူအမည် မတွေ့ပါ။");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      phone: phoneData,
      password,
    });

    if (signInError) {
      setError("စကားဝှက် မှားနေပါသည်။");
      setLoading(false);
      return;
    }

    window.location.assign("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-medium text-blue-700">DDD Calculation</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">ဒိုင်အကောင့် ဝင်ရန်</h1>
        <p className="mt-2 text-sm text-slate-500">ဖုန်းနံပါတ် သို့မဟုတ် အသုံးပြုသူအမည်ဖြင့် ဝင်ပါ</p>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            ဖုန်းနံပါတ် / အသုံးပြုသူအမည်
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            စကားဝှက်
            <input
              type="password"
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            className="w-full rounded-md bg-blue-700 px-4 py-2.5 font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "ဝင်နေသည်…" : "အကောင့်ဝင်မည်"}
          </button>
        </form>
      </section>
    </main>
  );
}
