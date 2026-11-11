import { Link } from "react-router-dom";
import { BRAND } from "@/lib/brand";

/** The original Karibu TV mark (TV with a K), in the kitenge palette. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#7a1a2e" />
      <rect x="12" y="16" width="40" height="26" rx="6" fill="#f6f5f9" />
      <path d="M24 50h16" stroke="#f6f5f9" strokeWidth="4" strokeLinecap="round" />
      <path d="M26 25v8M26 29l6-4M26 29l6 4" stroke="#7a1a2e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="40" cy="29" r="3" fill="#17182a" />
    </svg>
  );
}

export function Logo({ to = "/", size = 32, className = "", light = false }: { to?: string; size?: number; className?: string; light?: boolean }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight ${light ? "text-bone" : "text-navy"} ${className}`} aria-label={`${BRAND.name} home`}>
      <LogoMark size={size} />
      <span>{BRAND.name}</span>
    </Link>
  );
}
