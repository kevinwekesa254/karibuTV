import { Link } from "react-router-dom";
import { BRAND } from "@/lib/brand";

/** A TV screen with the sun rising in it: karibu, a new day, a warm welcome. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs><clipPath id="kb-screen"><rect x="11" y="13" width="42" height="29" rx="6" /></clipPath></defs>
      <rect width="64" height="64" rx="16" fill="#004227" />
      <rect x="11" y="13" width="42" height="29" rx="6" fill="#fff6e9" />
      <g clipPath="url(#kb-screen)">
        <circle cx="32" cy="42" r="12" fill="#f26b3a" />
        <rect x="11" y="38" width="42" height="4" fill="#f6b93b" />
      </g>
      <path d="M32 19v4M22.5 23.5l2.6 2.6M41.5 23.5l-2.6 2.6" stroke="#f26b3a" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 51h16" stroke="#fff6e9" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ to = "/", size = 32, className = "", light = false }: { to?: string; size?: number; className?: string; light?: boolean }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight ${light ? "text-cream" : "text-forest"} ${className}`} aria-label={`${BRAND.name} home`}>
      <LogoMark size={size} />
      <span>{BRAND.name}</span>
    </Link>
  );
}
