import type { InputHTMLAttributes } from "react";

export function TextField({
  label,
  id,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className="min-h-12 rounded-xl border border-prugna/15 bg-white px-4 text-base outline-none transition-colors placeholder:text-prugna/40 focus:border-oro focus:ring-2 focus:ring-oro/30"
        {...props}
      />
    </div>
  );
}
