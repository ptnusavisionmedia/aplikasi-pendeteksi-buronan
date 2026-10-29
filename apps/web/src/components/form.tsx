import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import clsx from "clsx";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px]">
      <span className="font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none focus:border-primary transition-colors",
        props.className
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        "bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none focus:border-primary transition-colors resize-none",
        props.className
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-[13.5px] outline-none focus:border-primary transition-colors",
        props.className
      )}
    />
  );
}

export function PrimaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "flex items-center justify-center gap-2 bg-primary text-white text-[13.5px] font-semibold px-4 py-2.5 rounded-xl shadow-pop hover:bg-primary-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    />
  );
}

export function GhostButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        "flex items-center justify-center gap-2 bg-canvas text-ink text-[13.5px] font-semibold px-4 py-2.5 rounded-xl hover:bg-line transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
    />
  );
}

export function Checkbox(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      {...props}
      className={clsx("w-4 h-4 rounded accent-primary cursor-pointer", props.className)}
    />
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="text-[12.5px] text-coral bg-coral-soft rounded-lg px-3 py-2">{children}</p>;
}

export function SuccessText({ children }: { children?: string | null }) {
  if (!children) return null;
  return <p className="text-[12.5px] text-primary bg-primary-soft rounded-lg px-3 py-2">{children}</p>;
}

export function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "primary" | "coral" | "amber" }) {
  const toneClasses: Record<string, string> = {
    muted: "bg-canvas text-muted",
    primary: "bg-primary-soft text-primary-ink",
    coral: "bg-coral-soft text-coral",
    amber: "bg-amber-soft text-amber",
  };
  return (
    <span className={clsx("inline-flex items-center px-2.5 py-1 rounded-lg text-[11.5px] font-bold", toneClasses[tone])}>
      {children}
    </span>
  );
}
