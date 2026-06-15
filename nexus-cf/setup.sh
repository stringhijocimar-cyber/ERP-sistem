#!/usr/bin/env bash
# ============================================================
# NEXUS ERP — Setup do backend canônico (Cloudflare Worker + D1)
# Automatiza os passos do DEPLOY.md. Rode a partir de nexus-cf/.
# Requer: Node 18+, npx; e `wrangler login` (ou CLOUDFLARE_API_TOKEN).
# ============================================================
set -euo pipefail

DB_NAME="nexus-erp-db"
TOML="wrangler.toml"

cd "$(dirname "$0")"

echo "▶ 1/4  Garantindo banco D1 '$DB_NAME'..."
if grep -q 'PREENCHER_APOS_CRIAR' "$TOML"; then
  echo "   Criando D1 e capturando database_id..."
  OUT="$(npx --yes wrangler d1 create "$DB_NAME" 2>&1 || true)"
  echo "$OUT"
  DBID="$(echo "$OUT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
  if [ -n "${DBID:-}" ]; then
    sed -i "s/PREENCHER_APOS_CRIAR/$DBID/" "$TOML"
    echo "   ✅ database_id gravado no $TOML: $DBID"
  else
    echo "   ⚠️  Não consegui extrair o database_id automaticamente."
    echo "      Cole-o manualmente no $TOML (campo database_id) e rode de novo."
    exit 1
  fi
else
  echo "   database_id já configurado. Pulando criação."
fi

echo "▶ 2/4  Aplicando schema (remoto e local)..."
npx --yes wrangler d1 execute "$DB_NAME" --remote --file=./schema.sql
npx --yes wrangler d1 execute "$DB_NAME" --local  --file=./schema.sql

echo "▶ 3/4  Definindo segredos (interativo)..."
echo "   Defina JWT_SECRET (mín. 16 chars):"
npx --yes wrangler secret put JWT_SECRET
echo "   Defina SEED_PASSWORD (senha inicial do admin):"
npx --yes wrangler secret put SEED_PASSWORD

echo "▶ 4/4  Deploy..."
npx --yes wrangler deploy

echo ""
echo "✅ Pronto. Verifique o gate de pagamento com os comandos do DEPLOY.md"
echo "   (CP-OK-001 deve pagar; CP-BLOQ-001 deve retornar 409)."
