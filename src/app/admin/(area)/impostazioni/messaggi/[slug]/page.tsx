import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackHeader } from "@/components/admin/BackHeader";
import { requireAdmin } from "@/lib/auth/admin";
import { loadBusinessInfo, loadTemplate } from "@/lib/notifications/context";
import { DEFAULT_TEMPLATES, MESSAGE_KIND_LABEL, templateBySlug, templateKey } from "@/lib/notifications/defaults";
import { allowedPlaceholders } from "@/lib/notifications/placeholders";
import { TemplateEditor } from "../TemplateEditor";
import { TestEmailForm } from "../TestEmailForm";

export const metadata: Metadata = { title: "Modifica messaggio" };

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const admin = await requireAdmin();
  const { slug } = await params;
  const meta = templateBySlug(slug);
  if (!meta) notFound();

  const [template, business] = await Promise.all([loadTemplate(meta.kind, meta.channel), loadBusinessInfo()]);
  const defaults = DEFAULT_TEMPLATES[templateKey(meta.kind, meta.channel)]!;

  return (
    <div className="flex flex-col gap-8">
      <BackHeader
        back={{ href: "/admin/impostazioni/messaggi", label: "Messaggi" }}
        title={`${meta.label} · ${meta.channel === "EMAIL" ? "email" : "WhatsApp"}`}
        description={meta.hint}
      />
      <TemplateEditor
        slug={meta.slug}
        kind={meta.kind}
        channel={meta.channel}
        initial={template}
        defaults={defaults}
        placeholders={allowedPlaceholders(meta.kind)}
        business={business}
        sampleNow={new Date().toISOString()}
      />
      {meta.channel === "EMAIL" ? (
        <TestEmailForm
          adminEmail={admin.email}
          fixedKind={meta.kind}
          options={[{ kind: meta.kind, label: MESSAGE_KIND_LABEL[meta.kind] }]}
        />
      ) : null}
    </div>
  );
}
