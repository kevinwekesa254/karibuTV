import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { analyticsEnabled, cookieChoice, initAnalytics, pageView, setCookieChoice, trackClicks, untracked } from "@/lib/analytics";

let started = false;

/** Asks once before Google Analytics loads, and reports page views as people move around the app. */
export function CookieBanner() {
  const { pathname } = useLocation();
  const [ask, setAsk] = useState(() => analyticsEnabled() && cookieChoice() === null);
  useEffect(() => { if (!started) { started = true; initAnalytics(); trackClicks(); } }, []);
  useEffect(() => { pageView(pathname); }, [pathname]);
  if (!ask || untracked(pathname)) return null;
  const choose = (v: "yes" | "no") => { setCookieChoice(v); setAsk(false); if (v === "yes") pageView(pathname); };
  return (
    <div role="dialog" aria-label="Cookies" className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-[18px] border border-line bg-white p-4 shadow-panel sm:bottom-5 sm:p-5">
      <p className="text-sm text-ink">We use Google Analytics cookies to see which pages help hosts, so we can improve Karibu TV. No ads, and we never sell data. <Link to="/privacy" className="font-semibold text-maroon underline">Privacy</Link></p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button className="kb-btn kb-btn--ghost kb-btn--sm" onClick={() => choose("no")}>No thanks</button>
        <button className="kb-btn kb-btn--primary kb-btn--sm" onClick={() => choose("yes")}>Accept</button>
      </div>
    </div>
  );
}
