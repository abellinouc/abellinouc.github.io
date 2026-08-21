# Il lato server

Tutto quello che gira sulla macchina Oracle e che serve al download offline.
Sta qui perché fino ad ora esisteva **solo su quella macchina**: se si perde, si
riscrive da zero.

Non contiene segreti. La chiave SSH non è qui e non deve finirci.

| file | dove va sul server |
|---|---|
| `hips_bundle.py` | `/opt/hips-bundle/hips_bundle.py` |
| `hips-bundle.service` | `/etc/systemd/system/hips-bundle.service` |
| `nginx/sites-available-default.conf` | `/etc/nginx/sites-available/default` |

## Cosa fa

`hips_bundle.py` è un servizio HTTP su `127.0.0.1:8088`, non esposto:
nginx gli passa davanti solo `/bundle`.

    GET /bundle?survey=dss&version=v1&order=8&from=0&to=1999

restituisce un tar con quei tile. Esiste perché **un ordine HiPS è grande in
FILE, non in byte**: il Norder 8 di DSS sono 29 GB in 786.423 file, e un
telefono che chiede tre quarti di milione di oggetti HTTPS separati passa la
serata sulle strette di mano invece che sui dati. Il client li scompatta e li
mette in cache sotto il loro URL vero, quello che il motore chiede — il tar
esiste solo durante il viaggio, non viene salvato da nessuna parte.

Nulla viene scritto su disco: il tar viene assemblato dentro la socket mentre
parte. La macchina ha pochi GB liberi e questo non deve mai essere ciò che li
riempie.

Un tile mancante non è un errore. Queste survey hanno buchi — gaia in
particolare — e viene semplicemente saltato.

## Due trappole che sono già costate tempo

**Un solo `Access-Control-Allow-Origin`.** Sta in nginx, a livello di `server`,
e vale per tutto. Se lo si aggiunge anche in Python il browser ne vede due e
**rifiuta la risposta**, il che assomiglia a un problema di rete e non lo è.

**Niente copie di backup dentro `sites-enabled/`.** nginx include *tutto* quello
che trova lì dentro, quindi un `default.bak` accanto all'originale dà
`duplicate default server` e `nginx -t` fallisce. Le copie vanno fuori, per
esempio in `/root/nginx-backups/`.

## Nota sui fine riga

La copia qui è in forma Unix. Quella attualmente su `/opt/hips-bundle/` ha i
fine riga Windows: è **lo stesso codice** — a CR rimossi l'md5 coincide — ma se
si confrontano gli md5 direttamente non tornano, e non è un file corrotto.

Funziona lo stesso perché systemd invoca `/usr/bin/python3 <file>` e lo shebang
non viene mai usato. Eseguirlo direttamente (`./hips_bundle.py`) invece
fallirebbe, con un errore che non spiega niente. Copiando da qui si sistema.

## Rimetterlo in piedi

    sudo install -D -m 755 hips_bundle.py /opt/hips-bundle/hips_bundle.py
    sudo install -D -m 644 hips-bundle.service /etc/systemd/system/hips-bundle.service
    sudo cp nginx/sites-available-default.conf /etc/nginx/sites-available/default

    sudo systemctl daemon-reload
    sudo systemctl enable --now hips-bundle
    sudo nginx -t && sudo systemctl reload nginx

Verifica:

    systemctl is-active hips-bundle
    curl -sI 'https://bigdata.ventanaceleste.com/bundle?survey=dss&version=v1&order=3&from=0&to=9'

Deve rispondere `content-type: application/x-tar` e **un solo**
`access-control-allow-origin`.

## Le survey

Stanno in `/var/www/html/surveys/<survey>/<version>/NorderN/Dir<n>/Npix<p>.<ext>`,
dove `<n>` è `floor(p / 10000) * 10000`. Il servizio legge il formato dei tile
dal file `properties` della survey, e se manca prova `webp, jpg, png, eph` —
serve per gaia, il cui `properties` è vuoto.

Misurato il 21 agosto 2026, e sono le cifre da cui il client calcola i pesi:

| survey | ordine | byte | file |
|---|---|---|---|
| dss | 3 | 10.825.328 | 768 |
| dss | 4 | 63.306.396 | 3.072 |
| dss | 5 | 405.888.578 | 12.288 |
| dss | 6 | 2.276.375.616 | 49.152 |
| dss | 7 | 9.341.821.434 | 196.607 |
| dss | 8 | 29.464.144.674 | 786.423 |
| dss | 9 | 80.005.244.232 | 3.145.521 |
| gaia | 3–8 | ~17 GB | 406.757 (parziale) |

Il client si ferma al Norder 8: il 9 da solo sono 80 GB.
