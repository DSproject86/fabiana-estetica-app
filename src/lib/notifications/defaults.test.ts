import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATES, PREVIOUS_DEFAULTS, TEMPLATE_LIST, seedTemplateAction, templateKey, type TemplateKey } from "./defaults";
import { validateTemplate, type TemplateChannel, type TemplateKind } from "./placeholders";

const split = (key: TemplateKey) => key.split(":") as [TemplateKind, TemplateChannel];

describe("testi predefiniti", () => {
  it("sono tutti validi (anche quelli vecchi) e ognuno ha la sua pagina", () => {
    for (const [key, text] of Object.entries(DEFAULT_TEMPLATES) as [TemplateKey, typeof DEFAULT_TEMPLATES[TemplateKey]][]) {
      if (!text) continue;
      const [kind, channel] = split(key);
      expect(validateTemplate({ kind, channel, ...text }), key).toBeNull();
      expect(TEMPLATE_LIST.some((t) => templateKey(t.kind, t.channel) === key), key).toBe(true);
    }
    for (const [key, list] of Object.entries(PREVIOUS_DEFAULTS) as [TemplateKey, NonNullable<(typeof PREVIOUS_DEFAULTS)[TemplateKey]>][]) {
      const [kind, channel] = split(key);
      for (const text of list) expect(validateTemplate({ kind, channel, ...text }), key).toBeNull();
    }
  });

  it("gli indirizzi delle pagine sono unici", () => {
    expect(new Set(TEMPLATE_LIST.map((t) => t.slug)).size).toBe(TEMPLATE_LIST.length);
  });
});

describe("seed dei testi", () => {
  const key: TemplateKey = "REMINDER:EMAIL";
  const old = PREVIOUS_DEFAULTS[key]![0];

  it("aggiorna solo i testi identici a un predefinito precedente (anche con a capo Windows)", () => {
    expect(seedTemplateAction(key, old)).toBe("update");
    expect(seedTemplateAction(key, { subject: old.subject, body: old.body.replace(/\n/g, "\r\n") })).toBe("update");
  });

  it("lascia stare i testi già nuovi e quelli modificati dall'admin", () => {
    expect(seedTemplateAction(key, DEFAULT_TEMPLATES[key]!)).toBe("keep");
    expect(seedTemplateAction(key, { subject: old.subject, body: `${old.body} ` })).toBe("keep");
    expect(seedTemplateAction(key, { subject: "Domani!", body: old.body })).toBe("keep");
  });
});
