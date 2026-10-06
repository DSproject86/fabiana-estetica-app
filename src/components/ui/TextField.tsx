import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const inputClass =
  "min-h-12 w-full rounded-xl border bg-white px-4 text-base outline-none transition-colors placeholder:text-prugna/40 focus:border-oro focus:ring-2 focus:ring-oro/30";

function borderClass(error?: string) {
  return error ? "border-red-700/60" : "border-prugna/15";
}

function FieldShell({
  id,
  label,
  hint,
  error,
  className = "",
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-800">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-prugna/60">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Extra = { label: string; id: string; hint?: string; error?: string };

export function TextField({
  label,
  id,
  hint,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & Extra) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${inputClass} ${borderClass(error)}`}
        {...props}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  id,
  hint,
  error,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & Extra) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        className={`${inputClass} ${borderClass(error)} min-h-24 py-3`}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  id,
  hint,
  error,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & Extra) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <select id={id} className={`${inputClass} ${borderClass(error)} appearance-auto`} {...props}>
        {children}
      </select>
    </FieldShell>
  );
}

/** Interruttore sì/no (checkbox con etichetta e descrizione). */
export function ToggleField({
  id,
  name,
  label,
  description,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-prugna/15 bg-white p-4"
    >
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-5 shrink-0 accent-[var(--color-prugna)]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description ? <span className="text-xs text-prugna/60">{description}</span> : null}
      </span>
    </label>
  );
}
