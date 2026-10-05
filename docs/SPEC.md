# Fabiana L. · Estetica — Specifiche

Webapp di prenotazioni per un'estetista (Fabiana L.) che lavora da sola.
Questo documento è il riferimento per tutti gli step di sviluppo.

## Stack e vincoli generali

- Next.js (App Router) + TypeScript + Tailwind.
- PostgreSQL su Neon con Prisma. Nello schema: `url = env("DATABASE_URL")` e
  `directUrl = env("DATABASE_URL_UNPOOLED")` (connessione diretta per le migrazioni).
- Hosting su Vercel (deploy automatico da `main`).
- Fuso orario **Europe/Rome** per tutti i calcoli, ora legale compresa.
- Interfaccia in italiano, pensata per il telefono.

## Clienti e accesso

- Clienti **solo su invito**: un link unico, rigenerabile dall'admin (il vecchio smette di funzionare).
- Iscrizione con nome, cognome, cellulare, email e consenso privacy.
- Accesso con **codice di 6 cifre inviato per email**, sessione lunga (6 mesi), nessuna password.
- L'admin può **bloccare** una cliente.

## Admin

- 2 admin (Fabiana e il marito) con email e password, area separata.
- Credenziali da `ADMIN_EMAIL_1/2` e `ADMIN_PASSWORD_1/2` tramite uno script di seed con password hashate.
- Sessione con cookie firmato da `SESSION_SECRET`.
- Menu: Agenda, Orari, Listino, Clienti, Pacchetti, Statistiche, Impostazioni.

## Listino

- Categorie e servizi con nome, durata in minuti, prezzo, attivo/nascosto.
- L'admin aggiunge, modifica ed elimina.
- Più pacchetti massaggi (vedi sotto).

## Prenotazione (lato cliente)

- La cliente spunta uno o più servizi e vede durata e prezzo totale.
- Poi vede giorni e orari liberi fino a **3 mesi** avanti, sceglie, vede il riepilogo e conferma.
- Sezione **"I miei appuntamenti"**.
- Per ora niente disdette lato cliente.

## Logica orari

- Durata = somma dei servizi, **arrotondata per eccesso** al multiplo dell'arrotondamento
  (default 30 min), **più una pausa** (default 30 min).
- Gli orari d'inizio seguono una **griglia** (default 30 min).
- Un orario è libero solo se **tutto l'intervallo** cade dentro l'orario di lavoro e non tocca
  appuntamenti o blocchi.
- **Preavviso minimo** di 1 ora.
- Nessun blocco temporaneo mentre la cliente sceglie: gli orari si ricalcolano a ogni spunta.
- Controllo finale sul server dentro una **transazione**, più un **vincolo nel database** contro le
  sovrapposizioni (Postgres exclusion constraint su `tstzrange`).
- Tutti i parametri si modificano dall'admin.

## Orari di lavoro

- Settimana tipo con una o più fasce per giorno.
- Eccezioni su singola data (orario diverso o chiuso).
- Blocchi rapidi di una fascia.
- Se un'eccezione o un blocco toccano appuntamenti già presi, l'admin vede un **avviso**;
  non si cancella niente in automatico.

## Agenda admin

- Elenco da oggi a fine mese, raggruppato per giorno, con navigazione ai mesi successivi.
- Spunta **"Fatto"** reversibile: la riga diventa verde e barrata e si apre il campo dell'importo
  incassato (precompilato col totale, modificabile).
- L'admin può inserire, spostare e cancellare appuntamenti.

## Pacchetti massaggi

- Per cliente, con nome, prezzo totale e numero sedute.
- Registro pagamenti (data, importo, contanti/carta) con pagato e residuo.
- Ogni seduta spuntata scala una seduta.

## Clienti (lato admin)

- Elenco con ricerca, storico, pacchetti attivi.
- Note allergie visibili solo all'admin.

## Statistiche

- Incassato giorno per giorno e totale del mese: appuntamenti spuntati + pagamenti dei pacchetti
  (alla data di registrazione).
- Confronto col mese precedente.
- Dettaglio per servizio.

## Notifiche

- Email automatiche con **Resend**:
  - codice di accesso;
  - conferma prenotazione;
  - promemoria il giorno prima alle 18, tramite un endpoint cron protetto da `CRON_SECRET`;
    non parte se la prenotazione è stata fatta nello stesso giorno;
  - modifiche e cancellazioni.
- Su ogni appuntamento un tasto **WhatsApp** (link `wa.me` con testo precompilato) per i messaggi
  manuali, più la lista **"Appuntamenti di domani"** con la spunta "inviato".
- Testi modificabili dall'admin.
- Il sistema di invio va scritto in modo che in futuro si possa aggiungere la **WhatsApp Cloud API**.

## PWA

- Installabile: manifest, service worker, icona.

## Grafica

| Ruolo              | Colore    |
| ------------------ | --------- |
| Rosa cipria        | `#D8A7A0` |
| Oro                | `#C9A66B` |
| Sfondo avorio      | `#FBF7F4` |
| Testo prugna       | `#3D2B33` |
| Completato (salvia)| `#8FB89A` |

- Titoli in **Playfair Display**, testo in **Inter**.
- Logo provvisorio: monogramma "FL" in un cerchio sottile oro + "Fabiana L. · Estetica" (SVG).
- Colori e nome tutti in **un unico file di configurazione**.

## Roadmap

1. Fondamenta
2. Listino
3. Orari di lavoro
4. Motore disponibilità con test automatici
5. Area cliente (accesso temporaneo senza codice, solo per i test)
6. Email e WhatsApp
7. Agenda admin e statistiche
8. Pacchetti, clienti, PWA e lancio

## Modo di lavorare

- Si lavora a step. Alla fine di ogni step: riepilogo e attesa di conferma prima di commit e push.
