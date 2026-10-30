#!/bin/sh
# Container "certificado" do docker-compose.prod.yml: roda antes do nginx.
# Sem certificado na pasta certs/, cria um autoassinado (o navegador
# mostra um aviso). Quando a TI entregar o certificado de verdade, basta
# colocar certificado.crt e certificado.key na pasta certs/ e reiniciar.
set -eu

PASTA=/certs
CRT="$PASTA/certificado.crt"
KEY="$PASTA/certificado.key"

if [ -f "$CRT" ] && [ -f "$KEY" ]; then
    echo "Usando o certificado da pasta certs/"
    exit 0
fi

ENDERECO="${SERVIDOR_ENDERECO:-localhost}"

# IP vira "IP:", nome vira "DNS:" no certificado
if echo "$ENDERECO" | grep -Eq '^[0-9]+(\.[0-9]+){3}$'; then
    SAN="IP:$ENDERECO"
else
    SAN="DNS:$ENDERECO"
fi

echo "Sem certificado em $PASTA: criando um provisório para $ENDERECO"

mkdir -p "$PASTA"
openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$KEY" -out "$CRT" \
    -subj "/CN=$ENDERECO" \
    -addext "subjectAltName=$SAN" 2>/dev/null
