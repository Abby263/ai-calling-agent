import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "border-transparent bg-brand-gradient text-white shadow-[0_8px_24px_-10px_rgba(79,70,229,0.6)] hover:brightness-110 hover:shadow-[0_10px_30px_-8px_rgba(79,70,229,0.65)]",
    secondary:
      "border-slate-200 bg-white/90 text-slate-800 backdrop-blur hover:border-slate-300 hover:bg-white dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-900",
    ghost:
      "border-transparent bg-transparent text-slate-700 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/80",
    danger:
      "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
  };
  return (
    <button
      className={`group inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold tracking-tight transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-950 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-10 w-full rounded-lg border border-slate-200 bg-white/95 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-100/70 dark:border-slate-700/70 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-brand-400 dark:focus:bg-slate-950 dark:focus:ring-brand-900/40 ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`min-h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white/95 bg-[length:18px_18px] bg-[right_0.6rem_center] bg-no-repeat px-3 pr-9 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100/70 dark:border-slate-700/70 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:border-slate-600 dark:focus:border-brand-400 dark:focus:ring-brand-900/40 ${className}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'><path d='M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.06l3.71-3.83a.75.75 0 1 1 1.08 1.04l-4.24 4.38a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06z'/></svg>\")"
      }}
      {...props}
    />
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100/70 dark:border-slate-700/70 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-brand-400 dark:focus:ring-brand-900/40 ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold tracking-tight ${className}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "div"
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "aside";
}) {
  return (
    <Tag
      className={`relative rounded-2xl border border-slate-200/70 bg-white/95 shadow-soft backdrop-blur-sm transition dark:border-slate-800/80 dark:bg-slate-900/70 ${className}`}
    >
      {children}
    </Tag>
  );
}

export function StatTile({
  label,
  value,
  icon,
  accent
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2.5 transition hover:border-brand-200 hover:shadow-soft dark:border-slate-800/80 dark:bg-slate-900/60 dark:hover:border-brand-700/50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {icon ? (
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300 ${accent ?? ""}`}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-1 font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  );
}
