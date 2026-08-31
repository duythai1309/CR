import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Card({
  title,
  description,
  action,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-soil-200 bg-white shadow-sm">
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-soil-200 px-5 py-4">
          <div>
            {title && <h2 className="font-semibold text-soil-900">{title}</h2>}
            {description && <p className="mt-1 text-sm text-soil-600">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "leaf",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "leaf" | "carbon" | "soil";
}) {
  const tones = {
    leaf: "border-leaf-200 bg-leaf-50 text-leaf-900",
    carbon: "border-carbon-100 bg-carbon-100/50 text-carbon-700",
    soil: "border-soil-200 bg-soil-100 text-soil-800",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs opacity-70">{hint}</div>}
    </div>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

const variants = {
  primary: "bg-leaf-700 text-white hover:bg-leaf-800",
  secondary: "border border-soil-200 bg-white text-soil-800 hover:bg-soil-100",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
  ghost: "text-soil-600 hover:bg-soil-100 hover:text-soil-900",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: keyof typeof variants }) {
  return <button className={`${buttonBase} ${variants[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: keyof typeof variants }) {
  return <Link className={`${buttonBase} ${variants[variant]} ${className}`} {...props} />;
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-soil-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-soil-600">{hint}</span>}
    </label>
  );
}

const controlClass =
  "w-full rounded-lg border border-soil-200 bg-white px-3 py-2 text-sm text-soil-900 outline-none focus:border-leaf-500 focus:ring-2 focus:ring-leaf-100";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function Badge({
  children,
  tone = "soil",
}: {
  children: ReactNode;
  tone?: "leaf" | "carbon" | "soil" | "red";
}) {
  const tones = {
    leaf: "bg-leaf-100 text-leaf-800",
    carbon: "bg-carbon-100 text-carbon-700",
    soil: "bg-soil-100 text-soil-700",
    red: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Empty({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-soil-200 px-4 py-10 text-center">
      <p className="font-medium text-soil-800">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-sm text-soil-600">{hint}</p>}
    </div>
  );
}

export function Alert({
  tone = "warn",
  title,
  children,
}: {
  tone?: "warn" | "error" | "ok";
  title?: ReactNode;
  children?: ReactNode;
}) {
  const tones = {
    warn: "border-carbon-100 bg-carbon-100/40 text-carbon-700",
    error: "border-red-200 bg-red-50 text-red-800",
    ok: "border-leaf-200 bg-leaf-50 text-leaf-800",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-soil-200 text-xs uppercase tracking-wide text-soil-600">
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-soil-100">{children}</tbody>
      </table>
    </div>
  );
}
