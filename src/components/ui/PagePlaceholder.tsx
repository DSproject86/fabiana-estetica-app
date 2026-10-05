/** Intestazione di pagina admin con riquadro "in arrivo" (pagine vuote dello step 1). */
export function PagePlaceholder({
  title,
  description,
  step,
}: {
  title: string;
  description: string;
  step: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl">{title}</h1>
        <p className="text-prugna/70">{description}</p>
      </header>
      <div className="rounded-2xl border border-dashed border-oro/50 bg-white/60 p-6 text-sm text-prugna/70">
        Questa sezione arriva con lo step {step}.
      </div>
    </div>
  );
}
