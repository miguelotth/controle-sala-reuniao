#!/bin/bash
# Backup do banco, dentro do container "backup" do docker-compose.prod.yml.
# Faz um backup ao subir e depois um por dia em BACKUP_HORA.
# Os arquivos ficam na pasta backups/ do servidor e os com mais de
# BACKUP_DIAS dias são apagados. A senha vem de MYSQL_PWD.
set -uo pipefail

HORA="${BACKUP_HORA:-02:00}"
DIAS="${BACKUP_DIAS:-30}"

fazer_backup() {
    local arquivo="/backups/sala-reuniao_$(date +%Y-%m-%d_%H%M).sql.gz"

    if mysqldump -h db -uroot --single-transaction --no-tablespaces \
        --databases controle_sala_reuniao | gzip > "$arquivo.tmp"; then
        mv "$arquivo.tmp" "$arquivo"
        echo "$(date '+%d/%m/%Y %H:%M') backup salvo: $(basename "$arquivo")"
    else
        rm -f "$arquivo.tmp"
        echo "$(date '+%d/%m/%Y %H:%M') ERRO: backup falhou" >&2
    fi

    find /backups -name 'sala-reuniao_*.sql.gz' -mtime +"$DIAS" -delete
}

fazer_backup

while true; do
    agora=$(date +%s)
    proximo=$(date -d "today $HORA" +%s)

    if [ "$proximo" -le "$agora" ]; then
        proximo=$(date -d "tomorrow $HORA" +%s)
    fi

    sleep $((proximo - agora))
    fazer_backup
done
