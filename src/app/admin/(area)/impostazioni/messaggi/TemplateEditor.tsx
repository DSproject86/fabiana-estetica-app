"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { composeEmail, composeWhatsapp, type EmailInput } from "@/lib/notifications/compose";
import type { TemplateText } from "@/lib/notifications/defaults";
import {
  BODY_MAX,
  PLACEHOLDERS,
  SUBJECT_MAX,
  validateTemplate,
  type Placeholder,
  type TemplateChannel,
  type TemplateKind,
} from "@/lib/notifications/placeholders";
import { SAMPLE_CODE, sampleAppointment, type BusinessInfo } from "@/lib/notifications/vars";
import { saveTemplateAction, type TemplateFormState } from "./actions";

const fieldClass =
  "w-full rounded-xl border border-prugna/15 bg-white px-4 text-base outline-none transition-colors focus:border-oro focus:ring-2 focus:ring-oro/30";

export function TemplateEditor({
  slug,
  kind,
  channel,
  initial,
  defaults,
  placeholders,
  business,
  sampleNow,
}: {
  slug: string;
  kind: TemplateKind;
  channel: TemplateChannel;
  initial: TemplateText;
  defaults: TemplateText;
  placeholders: Placeholder[];
  business: BusinessInfo;
  sampleNow: string;
}) {
  const [state, formAction, pending] = useActionState<TemplateFormState, FormData>(saveTemplateAction, {});
  const [subject, setSubject] = useState(initial.subject ?? "");
  const [body, setBody] = useState(initial.body);
  const [restored, setRestored] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  const isEmail = channel === "EMAIL";
  const problem = validateTemplate({ kind, channel, subject: isEmail ? subject : null, body });
  const dirty = subject !== (initial.subject ?? "") || body !== initial.body;
  const isDefault = subject === (defaults.subject ?? "") && body === defaults.body;

  const preview = useMemo(() => {
    const appointment = sampleAppointment(new Date(sampleNow));
    if (!isEmail) return { whatsapp: composeWhatsapp(body, appointment, business) };
    const input: EmailInput =
      kind === "LOGIN_CODE"
        ? { kind, client: appointment.client, code: SAMPLE_CODE }
        : kind === "APPOINTMENT_CHANGED"
          ? { kind, appointment, previousStartsAt: new Date(appointment.startsAt.getTime() - 86_400_000) }
          : { kind, appointment };
    return { email: composeEmail(input, { subject, body }, business) };
  }, [isEmail, kind, subject, body, business, sampleNow]);

  /** Inserisce il segnaposto dove si trova il cursore (nell'ultimo campo usato). */
  const insert = (placeholder: Placeholder) => {
    const token = `{${placeholder}}`;
    const target = isEmail && lastFocused.current === "subject" ? subjectRef.current : bodyRef.current;
    if (!target) return;
    const value = target.value;
    const start = target.selectionStart ?? value.length;
    const end = target.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    if (target === subjectRef.current) setSubject(next);
    else setBody(next);
    setRestored(false);
    requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const restore = () => {
    setSubject(defaults.subject ?? "");
    setBody(defaults.body);
    setRestored(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="slug" value={slug} />

        {isEmail ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="subject" className="text-sm font-medium">
              Oggetto
            </label>
            <input
              ref={subjectRef}
              id="subject"
              name="subject"
              value={subject}
              maxLength={SUBJECT_MAX}
              onChange={(e) => {
                setSubject(e.target.value);
                setRestored(false);
              }}
              onFocus={() => (lastFocused.current = "subject")}
              className={`${fieldClass} min-h-12`}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="body" className="text-sm font-medium">
            Testo
          </label>
          <textarea
            ref={bodyRef}
            id="body"
            name="body"
            value={body}
            rows={isEmail ? 10 : 5}
            maxLength={BODY_MAX[channel]}
            onChange={(e) => {
              setBody(e.target.value);
              setRestored(false);
            }}
            onFocus={() => (lastFocused.current = "body")}
            className={`${fieldClass} py-3 leading-relaxed`}
          />
          {isEmail ? (
            <p className="text-xs text-prugna/60">Una riga vuota separa i paragrafi.</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Segnaposto</span>
          <p className="text-xs text-prugna/60">Tocca per inserirlo dove si trova il cursore. Verrà sostituito coi dati veri.</p>
          <div className="flex flex-wrap gap-2">
            {placeholders.map((p) => (
              <button
                key={p}
                type="button"
                title={PLACEHOLDERS[p]}
                onClick={() => insert(p)}
                onMouseDown={(e) => e.preventDefault()} // non togliere il cursore dal campo
                className="inline-flex min-h-9 items-center rounded-full border border-oro/50 bg-avorio px-3 font-mono text-xs hover:bg-oro/15"
              >
                {`{${p}}`}
              </button>
            ))}
          </div>
        </div>

        {problem ? (
          <p role="alert" className="rounded-xl bg-cipria/25 px-4 py-3 text-sm">
            {problem}
          </p>
        ) : state.error && !pending ? (
          <p role="alert" className="rounded-xl bg-cipria/25 px-4 py-3 text-sm">
            {state.error}
          </p>
        ) : null}
        {restored ? (
          <p role="status" className="rounded-xl bg-oro/15 px-4 py-3 text-sm">
            Testo predefinito rimesso nel modulo: premi “Salva” per confermarlo.
          </p>
        ) : state.saved && !dirty && !pending ? (
          <p role="status" className="rounded-xl bg-salvia/25 px-4 py-3 text-sm">
            Testo salvato.
          </p>
        ) : null}

        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="ghost" onClick={restore} disabled={isDefault}>
            Ripristina testo predefinito
          </Button>
          <Button type="submit" disabled={pending || !!problem || !dirty}>
            {pending ? "Salvataggio…" : "Salva"}
          </Button>
        </div>
      </form>

      <section aria-labelledby="anteprima" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="anteprima" className="text-xl">
            Anteprima
          </h2>
          <p className="text-xs text-prugna/60">Con dati di esempio. Si aggiorna mentre scrivi.</p>
        </div>
        {preview.email ? (
          <>
            <p className="rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-prugna/5">
              <span className="text-prugna/60">Oggetto: </span>
              <span className="font-medium">{preview.email.subject}</span>
            </p>
            <iframe
              title="Anteprima dell'email"
              sandbox=""
              srcDoc={preview.email.html}
              className="h-[640px] w-full rounded-2xl bg-avorio ring-1 ring-prugna/10"
            />
            <details className="rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-prugna/5">
              <summary className="cursor-pointer">Versione solo testo</summary>
              <pre className="mt-3 font-sans whitespace-pre-wrap">{preview.email.text}</pre>
            </details>
          </>
        ) : (
          <div className="rounded-2xl bg-[#e5ddd5] p-4">
            <p className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] px-4 py-2.5 text-[15px] whitespace-pre-wrap text-[#111] shadow-sm">
              {preview.whatsapp}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
