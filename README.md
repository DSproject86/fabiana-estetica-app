# Fabiana L. · Estetica

Webapp di prenotazioni per Fabiana L. Le specifiche complete sono in [`docs/SPEC.md`](docs/SPEC.md).

Stack: Next.js (App Router) + TypeScript + Tailwind · PostgreSQL su Neon con Prisma 6 · Vercel.

## Comandi

```bash
npm install              # installa le dipendenze e genera il client Prisma
npm run dev              # sviluppo su http://localhost:3000
npm run lint             # ESLint
npm run typecheck        # controllo dei tipi
npm run build            # build di produzione (la usa anche Vercel)
```

## Database

Le migrazioni si applicano **solo a mano**, mai nel build di Vercel (Preview e Production
condividono lo stesso database). Mai `prisma db push`.

```bash
npm run db:migrate:status   # stato delle migrazioni
npm run db:migrate:deploy   # applica le migrazioni (usa DATABASE_URL_UNPOOLED)
npm run db:seed             # admin, parametri, testi: idempotente, si può rilanciare
```

Per una nuova migrazione: modificare `prisma/schema.prisma`, poi
`npx prisma migrate dev --create-only --name <nome>` su un database di sviluppo, controllare l'SQL e committarlo.
La migrazione iniziale contiene anche vincoli scritti a mano (anti-sovrapposizione degli
appuntamenti con `tstzrange`, controlli su orari e durate): Prisma li ignora e non li rimuove.

## Variabili d'ambiente

Vedi [`.env.example`](.env.example).

## Struttura

- `src/config/brand.ts`: nome, colori e font (unico file da modificare per la grafica)
- `src/app/admin/`: area admin (`login/` e le pagine del menu in `(area)/`)
- `src/lib/auth/`: sessioni con cookie firmato, password, controlli d'accesso
- `src/proxy.ts`: primo filtro sulle pagine `/admin`
- `prisma/`: schema, migrazioni, seed
