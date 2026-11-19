#!/usr/bin/env bash
# TP 4, etape 6 : le scenario complet, la panne, le rejeu. Prerequis : une pile NEUVE
#   docker compose -f compose.tp4.yaml down -v          (efface les bases d'une execution precedente)
#   docker compose -f compose.tp4.yaml up -d --build
# Lancer depuis la racine du depot (Git Bash) : bash docs/tp4/scenario-etape6.sh
export MSYS_NO_PATHCONV=1                       # Git Bash : ne pas reecrire /opt/kafka/... en C:/...
DC="docker compose -f compose.tp4.yaml"
KAFKA="$DC exec -T kafka /opt/kafka/bin"

releve() {   # releve <port> <troncon> <vitesse> <heure>
  curl -s -o /dev/null -w "  $2 $3 km/h a $4 -> %{http_code} en %{time_total} s\n" -X POST "localhost:$1/releves" \
    -H "Content-Type: application/json" \
    -d "{\"troncon\":\"$2\",\"vitesse\":$3,\"horodatage\":\"2026-11-19T$4:00\"}"
}
journal() {  # journal <service> : les lignes utiles, sans le bruit de kafkajs
  $DC logs --no-log-prefix "$1" 2>/dev/null | grep -E "^(recu|NOTIFICATION|doublon|message ignore|\[audit\])"
}
groupes() {
  $KAFKA/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group "$1" 2>/dev/null \
    | awk 'NF>=6 {print "  " $1, $2, $3, $4, $5, $6}'
}
incidents() {
  $DC exec -T notifications node --no-warnings -e "const {DatabaseSync}=require('node:sqlite');
    const b=new DatabaseSync('/donnees/notifications.db');
    console.log('  lignes dans incident : ' + b.prepare('select count(*) n from incident').get().n)"
}

# Garde (TP 5, etape 6) : sur une pile DEJA utilisee, les anciennes bases (volumes) faussent tout.
# Les troncons y sont deja "congestionnes" : aucun signalement ne part, et l'on croit a une panne.
DEJA=$($DC exec -T notifications node --no-warnings -e "const {DatabaseSync}=require('node:sqlite');
  console.log(new DatabaseSync('/donnees/notifications.db').prepare('select count(*) n from incident').get().n)" 2>/dev/null | tr -d '\r')
if [ "$DEJA" != "0" ]; then
  echo "La pile n'est pas neuve (incidents deja en base : ${DEJA:-pile non lancee ?}). Repartir de zero :"
  echo "  docker compose -f compose.tp4.yaml down -v"
  echo "  docker compose -f compose.tp4.yaml up -d --build"
  exit 1
fi

echo "===== 0. Le topic et les groupes"
$KAFKA/kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic signalements | awk 'NR==1' 
$KAFKA/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list | sed 's/^/  groupe : /'

echo; echo "===== 1. SCENARIO COMPLET (par Kafka) : de la mesure a l'alerte recue"
echo "  -- regle avec-minimum : il faut 3 releves lents en 15 min"
releve 8003 rue-de-rivoli-1 10 08:00; releve 8003 rue-de-rivoli-1 8 08:05; releve 8003 rue-de-rivoli-1 9 08:10
releve 8003 boulevard-voltaire-3 15 08:00; releve 8003 boulevard-voltaire-3 12 08:05; releve 8003 boulevard-voltaire-3 10 08:10
sleep 3
echo "  -- journal de Notifications (groupe notifications)"; journal notifications | sed 's/^/  /'
echo "  -- journal d'audit (groupe audit : partition, offset, cle)"; journal audit | cut -c1-110 | sed 's/^/  /'
echo "  -- offsets des deux groupes (GROUP TOPIC PARTITION CURRENT-OFFSET LOG-END-OFFSET LAG)"
groupes notifications; groupes audit
incidents

echo; echo "===== 2. PANNE : on coupe le second service (Notifications)"
$DC stop notifications >/dev/null 2>&1; echo "  notifications arrete"
echo "  -- en HTTP (trafic-http, port 8013) : 4 releves lents sur le peripherique"
for h in 09:00 09:01 09:02 09:03; do releve 8013 peripherique-porte-maillot 20 $h; done
echo "  -- par Kafka (trafic, port 8003) : 3 releves lents sur le peripherique"
for h in 09:00 09:01 09:02; do releve 8003 peripherique-porte-maillot 20 $h; done
sleep 1
echo "  -- le message attend dans le topic (LAG du groupe notifications)"; groupes notifications
echo "  -- on relance Notifications"
$DC start notifications >/dev/null 2>&1; sleep 12
journal notifications | tail -2 | sed 's/^/  /'
echo "  -- en HTTP, le signalement n'est pas parti ; il repartira au prochain releve, circuit referme (> 30 s)"
sleep 31; releve 8013 peripherique-porte-maillot 20 09:04; sleep 1
journal notifications | tail -2 | sed 's/^/  /'
incidents

echo; echo "===== 3. REJEU : le groupe notifications relit le topic depuis le debut"
$DC stop notifications >/dev/null 2>&1
etat=$($KAFKA/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group notifications --state 2>/dev/null | awk '$1=="notifications" {print $(NF-1)}')
echo "  etat du groupe notifications apres l'arret : $etat (Kafka n'accepte le rejeu que si le groupe est vide)"
$KAFKA/kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group notifications --topic signalements \
  --reset-offsets --to-earliest --execute 2>/dev/null | awk 'NF>=4 {print "  " $0}'
avant=$(journal notifications | grep -c '^NOTIFICATION')
$DC start notifications >/dev/null 2>&1; sleep 12
apres=$(journal notifications | grep -c '^NOTIFICATION')
echo "  -- journal de Notifications apres le rejeu"; journal notifications | tail -4 | sed 's/^/  /'
echo "  -- lignes NOTIFICATION dans le journal : $avant avant le rejeu, $apres apres"
groupes notifications
echo "  -- le groupe audit n'a pas bouge"; groupes audit
incidents
