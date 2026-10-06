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
- Menu: Agenda, Promemoria di domani, Orari, Listino, Clienti, Pacchetti, Statistiche, Impostazioni.

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
  - promemoria il giorno prima alle 18 (`Settings.reminderHour`), tramite un endpoint cron protetto da `CRON_SECRET`;
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
5. Area cliente (con accesso tramite codice via email già da questo step)
6. Email e WhatsApp
7. Agenda admin e statistiche
8. Pacchetti, clienti, PWA e lancio

## Modo di lavorare

- Si lavora a step. Alla fine di ogni step: riepilogo e attesa di conferma prima di commit e push.

## Decisioni prese (step 1)

- **Email cliente facoltativa** nel database (`Client.email` nullable e unica): obbligatoria per chi si
  iscrive dal link, facoltativa per le clienti inserite a mano dall'admin.
- **Pausa:** il controllo "dentro l'orario di lavoro" usa la fine **senza pausa**; la pausa serve solo
  a distanziare gli appuntamenti. `endsAt` include la pausa (vincolo anti-sovrapposizione), quindi
  l'ultimo appuntamento può finire esattamente all'orario di chiusura.
- **Pausa per singolo appuntamento:** l'admin può impostare `bufferMin = 0` sugli appuntamenti che crea.
- **Stato NO_SHOW** ("non presentata"): non blocca il calendario; nelle statistiche si conta a parte.
- **Incassi senza doppi conteggi:** alla spunta "Fatto" l'importo precompilato esclude le voci scalate da
  un pacchetto (`clientPackageId` valorizzato), perché quei soldi stanno in `PackagePayment`.
- **Ora del promemoria** modificabile: `Settings.reminderHour` (default 18).
- **Migrazioni:** solo con `prisma migrate` (mai `db push`), lanciate a mano con `prisma migrate deploy`.
  Non fanno parte del build di Vercel (Preview e Production condividono lo stesso database).
- **Seed idempotente** (upsert), rilanciabile senza creare duplicati.
- **Sessioni:** cookie firmato (JWT HS256 con `SESSION_SECRET`) che contiene id e `sessionVersion`;
  aumentare `sessionVersion` invalida tutte le sessioni di quell'utente.
- **Prisma 6.x:** la 7 non accetta più `url`/`directUrl` nello schema.

## Decisioni prese (step 5)

- **Accesso con codice già allo step 5** (non più accesso temporaneo senza codice). Invio con Resend tramite
  `RESEND_API_KEY` ed `EMAIL_FROM`; finché non c'è un dominio verificato, Resend consegna solo all'email del
  proprietario dell'account. Conferme, promemoria e altre email restano allo step 6.
- **Codice:** 6 cifre, salvato come HMAC-SHA256 (chiave ricavata da `SESSION_SECRET`), valido 10 minuti,
  massimo 5 tentativi; vale solo l'ultimo codice richiesto. Massimo 3 codici ogni 15 minuti per email.
- **Risposte neutre:** "Se l'email è registrata riceverai un codice" per tutte le email; il codice si prepara e
  si invia dopo la risposta, così nemmeno i tempi rivelano chi è iscritta. Ogni invio finisce in `NotificationLog`.
- **Sessione cliente:** cookie `fl_client` separato da quello admin, 180 giorni. L'email in attesa del codice sta
  in un cookie firmato di 30 minuti (`fl_login`), non nell'indirizzo. Una cliente bloccata esce subito.
- **Link d'invito:** un solo link attivo, garantito da un indice unico parziale nel database; "Rigenera" disattiva
  il vecchio. Massimo **5 iscrizioni all'ora** per link (oltre: "Riprova più tardi", per tutte). Se l'email è già
  iscritta non si crea un doppione e i dati non cambiano: si passa al codice.
- **Cellulare** sempre in formato `+39…` (i numeri esteri scritti con `+` o `00` restano col loro prefisso).
- **WhatsApp di Fabiana:** `Settings.businessWhatsapp`, modificabile da Impostazioni; se vuoto il pulsante
  "Scrivi a Fabiana" non compare.
- **Indirizzo del link d'invito:** `APP_URL` se impostata, altrimenti il dominio da cui si sta navigando.

## Decisioni prese (step 6)

- **Un solo punto di invio:** `src/lib/notifications/deliver.ts` registra ogni invio in `NotificationLog`
  (PENDING → SENT / FAILED / SKIPPED) e non lancia mai errori: un'email non partita non blocca niente.
  `src/lib/email/send.ts` resta l'unico contatto con Resend (Reply-To da `EMAIL_REPLY_TO`, allegati, almeno
  0,6 s tra due invii, un solo nuovo tentativo solo se Resend risponde 429). Qui si aggiungerà la WhatsApp Cloud API.
- **Link nelle email:** sempre `APP_URL` (`{link}` = `APP_URL/appuntamenti`).
- **Grafica email:** tabelle e stili in linea, larghezza max 560px, monogramma FL in HTML, colori da `brand.ts`.
  Sotto il testo modificabile c'è sempre il riquadro automatico (data, ora, servizi, durata, totale); in fondo
  indirizzo, WhatsApp ed email di risposta. Sempre anche la versione solo testo.
- **Conferma:** dopo la prenotazione della cliente, con `after()`: email alla cliente con `.ics` (orari in UTC,
  fine senza pausa, UID fisso per appuntamento e SEQUENCE crescente) e avviso agli admin con
  `Admin.notifyNewBooking` acceso (testo fisso, Reply-To della cliente). Nessun avviso per gli appuntamenti
  inseriti dall'admin.
- **Modifica e cancellazione:** `sendAppointmentChangedEmail(id, inizioPrecedente)` (con `.ics` aggiornato e
  riga "Prima era") e `sendAppointmentCancelledEmail(id)`, pronte da collegare all'agenda allo step 7.
- **Promemoria:** `GET/POST /api/cron/promemoria`, `Authorization: Bearer CRON_SECRET` confrontato a tempo
  costante, chiamato ogni ora. Invia per gli appuntamenti CONFIRMED di domani solo se a Roma l'ora è
  ≥ `Settings.reminderHour`. Salta (senza segnare niente, stato "non prevista") le clienti senza email e gli
  appuntamenti prenotati il giorno prima dell'appuntamento. Ogni appuntamento si "prende in carico" con un
  aggiornamento condizionato di `reminderEmailSentAt` (da vuoto a adesso) nella stessa transazione della riga
  di log: due chiamate, anche simultanee, non mandano mai due email. Se l'invio fallisce non si riprova in
  automatico. `maxDuration` 60 s; dopo ~45 s si ferma e il JSON dice quanti ne restano (partono all'ora dopo).
  Le chiamate dopo mezzanotte non recuperano i promemoria del giorno prima.
- **Riprova** (pagina "Promemoria di domani"): blocca la riga dell'appuntamento (`FOR UPDATE`) e invia solo se
  l'ultimo tentativo è FAILED (o rimasto PENDING da più di 10 minuti): due clic non producono due email.
- **Step 7:** quando l'admin sposta un appuntamento a un altro giorno va azzerato `reminderEmailSentAt`
  (e `whatsappSentAt`), così il promemoria riparte per la nuova data.
- **Segnaposto:** `{nome} {cognome} {data} {ora} {servizi} {durata} {totale} {indirizzo} {link}`; il codice di
  accesso ammette solo `{nome} {cognome} {codice} {link}` e deve contenere `{codice}`. I segnaposto sbagliati
  non si salvano.
- **Seed dei testi:** i predefiniti stanno in `src/lib/notifications/defaults.ts`; il seed aggiorna solo i
  template identici a un predefinito precedente (`PREVIOUS_DEFAULTS`), quelli modificati non li tocca.
- **WhatsApp manuale:** link `wa.me` coi testi dei template WHATSAPP (agenda: Conferma / Promemoria;
  "Promemoria di domani": Promemoria con spunta "inviato" reversibile su `whatsappSentAt`).
- **Email di prova** (`NotificationLog.isTest`) all'admin collegato, coi dati di esempio e il testo salvato.
- **`Settings.businessAddress`** facoltativo, usato in email e `.ics`.

## Decisioni prese (step 7)

- **Nessuna migrazione:** lo schema degli step precedenti bastava (`doneAt`, `amountCollectedCents`, `NO_SHOW`,
  `cancelledBy`, `bufferMin`, `PackagePayment.paidOn`).
- **Agenda** (`/admin/agenda?mese=AAAA-MM`): il mese corrente parte da oggi (link "giorni precedenti"), gli altri
  mesi sono interi. Per giorno: fasce effettive, eccezione, blocchi e appuntamenti (ora inizio–fine senza pausa,
  cliente, allergie, servizi, totale, WhatsApp). I giorni senza appuntamenti né blocchi stanno su una riga; gli
  annullati sono chiusi in "N annullati · mostra".
- **Stati:** confermato · Fatto (CONFIRMED + `doneAt`) · Non presentata (NO_SHOW) · annullato (CANCELLED).
  Sposta, Servizi e Annulla solo su confermati non Fatti; Fatto e Non presentata dal giorno dell'appuntamento.
- **Fatto:** un tocco salva `doneAt` e l'importo precompilato (totale senza le voci con `clientPackageId`), poi si
  apre il riquadro per correggerlo. Togliere la spunta azzera `doneAt` e importo. "Non presentata" si ripristina solo
  se nel frattempo l'orario non è stato occupato.
- **"N appuntamenti passati non segnati"** (confermati, trattamento finito, né Fatti né Non presentata): avviso in
  cima all'agenda (tutti) e nelle statistiche (quelli del mese), con link alla vista `?vista=da-segnare`.
- **Operazioni** in `src/lib/agenda/mutations.ts`, tutte sotto `withBookingLock`; la violazione del vincolo
  anti-sovrapposizione diventa un messaggio leggibile. Il controllo dell'orario (`checkStart`) è lo stesso di
  `createAppointment`, con `excludeAppointmentId` (sposta/modifica) e `ignoreWorkingHours`.
- **Admin:** niente preavviso né limite dei mesi; anche servizi nascosti. "Senza pausa" = `bufferMin` 0 (togliendolo
  torna la pausa dell'appuntamento o quella di default). **"Fuori orario"** ignora fasce, blocchi e griglia, ora
  scritta a mano a passi di 5 minuti, con spunta di conferma esplicita; le sovrapposizioni restano sempre vietate.
- **Nuova cliente al volo** (`source` ADMIN, email facoltativa): con un'email già usata si deve scegliere quella
  cliente; con un cellulare già usato si propone quella cliente ma si può "creare comunque".
- **Sposta:** se cambia il giorno azzera `reminderEmailSentAt` e `whatsappSentAt`. **Modifica servizi:** le voci che
  restano tengono prezzo, durata e pacchetto originali, quelle nuove prendono il listino attuale; durata ricalcolata
  con l'arrotondamento attuale.
- **Email:** conferma (nuovo), APPOINTMENT_CHANGED con `.ics` (sposta e servizi), APPOINTMENT_CANCELLED (annulla),
  inviate con `after()`. Interruttore acceso di default solo se l'appuntamento è futuro e la cliente ha l'email.
  Dopo ogni operazione l'agenda mostra un riquadro col pulsante WhatsApp del messaggio giusto
  (conferma / spostamento / riepilogo / cancellazione).
- **Statistiche** (`/admin/statistiche?mese=`): appuntamenti Fatti (`amountCollectedCents`, nel giorno a Roma di
  `startsAt`) + pagamenti dei pacchetti (`paidOn`), separati e sommati; confronto col mese precedente (± € e %,
  niente % se il mese prima era a zero). Per servizio: volte (di cui da pacchetto, che valgono 0 €) e "ha reso",
  cioè l'incassato di ogni appuntamento diviso tra le voci pagate in proporzione al listino (resti più grandi, la somma
  torna al centesimo; un incasso senza voci pagate va in "Extra"). Conteggi di Fatti, Non presentate e Annullati.
- **Grafico:** barre impilate in CSS, colori `brand.chart` (verificati per daltonismo e contrasto), tabella dei giorni.

## Da fare prima del lancio

- Informativa privacy definitiva (ora `/privacy` ha un testo provvisorio; aggiornare anche `PRIVACY_VERSION`).
- ~~Dominio verificato su Resend e `EMAIL_FROM` con quel dominio.~~ Fatto allo step 6 (fabianaestetica.it).
