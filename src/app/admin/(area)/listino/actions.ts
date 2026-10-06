"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import {
  categorySchema,
  packageTemplateSchema,
  parseForm,
  serviceSchema,
  type FormState,
} from "@/lib/listino/validation";

// Ogni azione è un endpoint pubblico: il controllo admin va fatto sempre, qui dentro.

const LISTINO = "/admin/listino";

function done(): never {
  revalidatePath(LISTINO);
  redirect(LISTINO);
}

// ─────────────── Categorie ───────────────

export async function createCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(categorySchema, formData);
  if ("state" in parsed) return parsed.state;

  const last = await prisma.serviceCategory.aggregate({ _max: { sortOrder: true } });
  const category = await prisma.serviceCategory.create({
    data: { ...parsed.data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
  // Categoria nuova = vuota: si passa subito al primo servizio.
  revalidatePath(LISTINO);
  redirect(`${LISTINO}/servizi/nuovo?categoria=${category.id}`);
}

export async function updateCategory(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(categorySchema, formData);
  if ("state" in parsed) return parsed.state;

  await prisma.serviceCategory.update({ where: { id }, data: parsed.data });
  done();
}

export async function deleteCategory(id: string): Promise<FormState> {
  await requireAdmin();
  const services = await prisma.service.count({ where: { categoryId: id } });
  if (services > 0) {
    return {
      error: `La categoria contiene ancora ${services === 1 ? "1 servizio" : `${services} servizi`}: eliminali o spostali in un'altra categoria prima di eliminarla.`,
    };
  }
  await prisma.serviceCategory.delete({ where: { id } });
  done();
}

// ─────────────── Servizi ───────────────

export async function createService(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(serviceSchema, formData);
  if ("state" in parsed) return parsed.state;
  const { price, ...data } = parsed.data;

  const category = await prisma.serviceCategory.findUnique({ where: { id: data.categoryId } });
  if (!category) return { fieldErrors: { categoryId: "Categoria non trovata." } };

  const last = await prisma.service.aggregate({
    where: { categoryId: data.categoryId },
    _max: { sortOrder: true },
  });
  await prisma.service.create({
    data: { ...data, priceCents: price, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
  done();
}

export async function updateService(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(serviceSchema, formData);
  if ("state" in parsed) return parsed.state;
  const { price, ...data } = parsed.data;

  const current = await prisma.service.findUnique({ where: { id } });
  if (!current) return { error: "Servizio non trovato." };

  let sortOrder = current.sortOrder;
  if (current.categoryId !== data.categoryId) {
    // Cambio categoria: il servizio va in fondo alla nuova categoria.
    const last = await prisma.service.aggregate({
      where: { categoryId: data.categoryId },
      _max: { sortOrder: true },
    });
    sortOrder = (last._max.sortOrder ?? -1) + 1;
  }

  await prisma.service.update({
    where: { id },
    data: { ...data, priceCents: price, sortOrder },
  });
  done();
}

/**
 * Eliminare un servizio non tocca lo storico: gli appuntamenti conservano
 * nome, durata e prezzo copiati al momento della prenotazione.
 */
export async function deleteService(id: string): Promise<FormState> {
  await requireAdmin();
  await prisma.service.delete({ where: { id } });
  done();
}

// ─────────────── Pacchetti a listino ───────────────

export async function createPackageTemplate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(packageTemplateSchema, formData);
  if ("state" in parsed) return parsed.state;
  const { price, ...data } = parsed.data;

  const last = await prisma.packageTemplate.aggregate({ _max: { sortOrder: true } });
  await prisma.packageTemplate.create({
    data: { ...data, priceCents: price, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
  done();
}

export async function updatePackageTemplate(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parseForm(packageTemplateSchema, formData);
  if ("state" in parsed) return parsed.state;
  const { price, ...data } = parsed.data;

  await prisma.packageTemplate.update({ where: { id }, data: { ...data, priceCents: price } });
  done();
}

/** I pacchetti già venduti alle clienti restano: perdono solo il collegamento al modello. */
export async function deletePackageTemplate(id: string): Promise<FormState> {
  await requireAdmin();
  await prisma.packageTemplate.delete({ where: { id } });
  done();
}

// ─────────────── Ordinamento (frecce su/giù) ───────────────

type Direction = "up" | "down";

async function swapWithNeighbour(
  items: { id: string; sortOrder: number }[],
  id: string,
  direction: Direction,
  update: (id: string, sortOrder: number) => Promise<unknown>,
) {
  const index = items.findIndex((item) => item.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= items.length) return;

  // Riassegna 0..n-1 così l'ordine resta pulito anche se ci fossero valori uguali.
  const reordered = [...items];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  await Promise.all(
    reordered.map((item, position) =>
      item.sortOrder === position ? null : update(item.id, position),
    ),
  );
}

export async function moveCategory(id: string, direction: Direction) {
  await requireAdmin();
  await prisma.$transaction(async (tx) => {
    const items = await tx.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, sortOrder: true },
    });
    await swapWithNeighbour(items, id, direction, (itemId, sortOrder) =>
      tx.serviceCategory.update({ where: { id: itemId }, data: { sortOrder } }),
    );
  });
  revalidatePath(LISTINO);
}

export async function moveService(id: string, direction: Direction) {
  await requireAdmin();
  await prisma.$transaction(async (tx) => {
    const service = await tx.service.findUnique({ where: { id }, select: { categoryId: true } });
    if (!service) return;
    const items = await tx.service.findMany({
      where: { categoryId: service.categoryId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, sortOrder: true },
    });
    await swapWithNeighbour(items, id, direction, (itemId, sortOrder) =>
      tx.service.update({ where: { id: itemId }, data: { sortOrder } }),
    );
  });
  revalidatePath(LISTINO);
}

export async function movePackageTemplate(id: string, direction: Direction) {
  await requireAdmin();
  await prisma.$transaction(async (tx) => {
    const items = await tx.packageTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, sortOrder: true },
    });
    await swapWithNeighbour(items, id, direction, (itemId, sortOrder) =>
      tx.packageTemplate.update({ where: { id: itemId }, data: { sortOrder } }),
    );
  });
  revalidatePath(LISTINO);
}
