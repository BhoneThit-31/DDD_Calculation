"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DisplayModeToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncState);
    syncState();
    return () => document.removeEventListener("fullscreenchange", syncState);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen can be rejected by browser policy; keep the page usable.
    }
  };

  return <div className="flex items-center gap-2">
    <Link href="/settings" className="settings-link rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">စီမံခန့်ခွဲရန်</Link>
    <button type="button" onClick={toggleFullscreen} aria-label={isFullscreen ? "Minimize" : "Maximize"} title={isFullscreen ? "Minimize" : "Maximize"} className="display-mode-toggle flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">
      <span aria-hidden="true" className="text-lg leading-none">{isFullscreen ? "⤢" : "⛶"}</span>
    </button>
  </div>;
}
