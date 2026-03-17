#!/usr/bin/env bash
set -euo pipefail

echo "═══════════════════════════════════"
echo "  TABÚ — Instalación y Despliegue"
echo "═══════════════════════════════════"

# Instalar dependencias del servidor
echo ""
echo "[1/4] Instalando dependencias del servidor..."
cd server
npm install --omit=dev
cd ..

# Instalar dependencias del cliente
echo "[2/4] Instalando dependencias del cliente..."
cd client
npm install
cd ..

# Construir el frontend
echo "[3/4] Construyendo el frontend..."
cd client
npm run build
cd ..

# Verificar .env del servidor
echo "[4/4] Verificando configuración..."
if [ ! -f server/.env ]; then
  cp server/.env.example server/.env
  echo "  ⚠  Se creó server/.env desde .env.example"
  echo "     Edítalo con tus claves de API antes de iniciar."
else
  echo "  ✓  server/.env encontrado"
fi

echo ""
echo "═══════════════════════════════════"
echo "  ✓ Listo. Para iniciar:"
echo ""
echo "    cd server && npm start"
echo "═══════════════════════════════════"
