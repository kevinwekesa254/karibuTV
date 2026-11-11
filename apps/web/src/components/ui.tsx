import {
  forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Icon } from "./Icons";

type Variant = "primary" | "secondary" | "ghost" | "mint" | "sun" | "danger";
type Size = "sm" | "md" | "lg";
const btn = (v: Variant, s: Size, extra = "") => `kb-btn kb-btn--${v} kb-btn--${s} ${extra}`;

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean; icon?: string }>(
  function Button({ variant = "primary", size = "md", loading, icon, className = "", children, disabled, type = "button", ...rest }, ref) {
    return (
      <button ref={ref} type={type} className={btn(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
        {loading ? <Spinner size={16} /> : icon ? <Icon name={icon} size={size === "sm" ? 16 : 18} /> : null}
        {children}
      </button>
    );
  },
);

export function ButtonLink({ variant = "primary", size = "md", className = "", icon, children, ...rest }: LinkProps & { variant?: Variant; size?: Size; icon?: string }) {
  return (
    <Link className={btn(variant, size, className)} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children}
    </Link>
  );
}

export function Spinner({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader() {
  return <div className="flex min-h-[40vh] items-center justify-center text-green"><Spinner size={28} /></div>;
}

export function Card({ className = "", children, as: As = "div", ...rest }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" } & Record<string, unknown>) {
  return <As className={`kb-card ${className}`} {...rest}>{children}</As>;
}

export function Tag({ children, tone = "mint", className = "" }: { children: ReactNode; tone?: "mint" | "ink" | "danger" | "muted" | "warning"; className?: string }) {
  const tones = {
    mint: "", ink: "!bg-ink !text-on-ink", danger: "!bg-danger/10 !text-danger",
    muted: "!bg-line !text-ink-muted", warning: "!bg-warning/10 !text-warning",
  };
  return <span className={`kb-tag ${tones[tone]} ${className}`}>{children}</span>;
}

export const ProTag = () => <Tag tone="ink">PRO</Tag>;

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`kb-eyebrow ${className}`}>{children}</p>;
}

interface FieldProps { label?: ReactNode; hint?: ReactNode; error?: string | null; children: (id: string, describedBy?: string) => ReactNode; className?: string; optional?: boolean }
export function Field({ label, hint, error, children, className = "", optional }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="kb-label">
          {label}{optional && <span className="ml-1 font-normal text-ink-muted">(optional)</span>}
        </label>
      )}
      {children(id, [hintId, errId].filter(Boolean).join(" ") || undefined)}
      {error ? <p id={errId} className="kb-error">{error}</p> : hint ? <p id={hintId} className="kb-hint">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className = "", invalid, ...rest }, ref) {
    return <input ref={ref} className={`kb-input ${className}`} aria-invalid={invalid || undefined} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ className = "", invalid, rows = 3, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={`kb-input resize-y ${className}`} aria-invalid={invalid || undefined} {...rest} />;
  },
);

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={`kb-input appearance-none pr-10 ${className}`} {...rest}>{children}</select>
      <Icon name="chevron-down" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean; id?: string }) {
  const auto = useId();
  const tid = id || auto;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={tid} className="text-sm font-semibold text-ink">{label}</label>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      <button id={tid} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-50 ${checked ? "bg-green" : "bg-line-strong/50"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; disabled?: boolean }[]; label: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-full border border-line bg-surface-wash p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-full font-semibold transition-colors disabled:opacity-40 ${size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm"} ${value === o.value ? "bg-ink text-on-ink" : "text-ink hover:bg-mint-soft"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Modal dialog (bottom sheet on phones). */
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,select,textarea,button:not([data-close])")?.focus(), 30);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-lg bg-surface shadow-panel sm:rounded-lg ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id={titleId} className="font-display text-xl font-semibold text-forest">{title}</h2>
          <button data-close type="button" onClick={onClose} className="rounded-full p-2 text-ink-muted hover:bg-mint-soft" aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, body, confirmLabel = "Confirm", danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>}>
      <div className="text-ink">{body}</div>
    </Modal>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mint-soft text-forest"><Icon name={icon} size={26} /></div>
      <h3 className="font-display text-xl font-semibold text-forest">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatusDot({ status }: { status: "online" | "idle" | "offline" | "never" }) {
  const c = { online: "bg-[#12b76a]", idle: "bg-warning", offline: "bg-danger", never: "bg-line-strong" }[status];
  const label = { online: "Online", idle: "Idle", offline: "Offline", never: "Not seen yet" }[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
      <span className={`h-2.5 w-2.5 rounded-full ${c}`} aria-hidden="true" />{label}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1">{eyebrow}</Eyebrow>}
        <h1 className="font-display text-display-sm text-forest sm:text-[2rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorBanner({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
      <span>{children}</span>{action}
    </div>
  );
}
