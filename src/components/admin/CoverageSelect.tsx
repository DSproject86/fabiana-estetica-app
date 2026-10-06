import { SelectField } from "@/components/ui/TextField";

export type CoverageGroup = {
  name: string;
  category: { value: string; label: string };
  services: { value: string; label: string }[];
};

/** Menu "Valido per": un'intera categoria oppure un singolo servizio (o nessuno). */
export function CoverageSelect({
  groups,
  error,
  value,
  defaultValue,
  onChange,
}: {
  groups: CoverageGroup[];
  error?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <SelectField
      id="coverage"
      name="coverage"
      label="Valido per"
      hint="Alla spunta “Fatto” l'agenda propone di scalare la seduta quando il servizio coincide o è della categoria scelta."
      error={error}
      {...(value !== undefined ? { value, onChange: (e) => onChange?.(e.target.value) } : { defaultValue })}
    >
      <option value="">Nessun servizio (non si scala dall&apos;agenda)</option>
      {groups.map((g) => (
        <optgroup key={g.category.value} label={g.name}>
          <option value={g.category.value}>{g.category.label}</option>
          {g.services.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </optgroup>
      ))}
    </SelectField>
  );
}
