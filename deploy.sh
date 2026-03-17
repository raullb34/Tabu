#!/usr/bin/env bash
set -euo pipefail

DOMAIN="juegosmonos.duckdns.org"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=3001

echo "═══════════════════════════════════"
echo "  TABÚ — Instalación y Despliegue"
echo "  Dominio: $DOMAIN"
echo "═══════════════════════════════════"

# ── 1. Dependencias del servidor ──
echo ""
echo "[1/6] Instalando dependencias del servidor..."
cd "$APP_DIR/server"
npm install --omit=dev
cd "$APP_DIR"

# ── 2. Dependencias del cliente ──
echo "[2/6] Instalando dependencias del cliente..."
cd "$APP_DIR/client"
npm install
cd "$APP_DIR"

# ── 3. Construir el frontend ──
echo "[3/6] Construyendo el frontend..."
cd "$APP_DIR/client"
VITE_SERVER_URL="https://$DOMAIN" npm run build
cd "$APP_DIR"

# ── 4. Configurar .env del servidor ──
echo "[4/6] Configurando variables de entorno del servidor..."
if [ ! -f server/.env ]; then
  if [ -f server/.env.example ]; then
    cp server/.env.example server/.env
  else
    touch server/.env
  fi
  echo "  ⚠  Se creó server/.env — Edítalo con tus claves de API."
fi

# Actualizar CLIENT_URL y PORT en .env
grep -q '^CLIENT_URL=' server/.env 2>/dev/null \
  && sed -i "s|^CLIENT_URL=.*|CLIENT_URL=https://$DOMAIN|" server/.env \
  || echo "CLIENT_URL=https://$DOMAIN" >> server/.env

grep -q '^PORT=' server/.env 2>/dev/null \
  && sed -i "s|^PORT=.*|PORT=$PORT|" server/.env \
  || echo "PORT=$PORT" >> server/.env

echo "  ✓  server/.env configurado"

# ── 5. Instalar y configurar Nginx + Certbot ──
echo "[5/6] Configurando Nginx y SSL..."

# Instalar Nginx y Certbot si no están presentes
if ! command -v nginx &>/dev/null; then
  echo "  Instalando Nginx..."
  sudo apt-get update -qq && sudo apt-get install -y -qq nginx
fi
if ! command -v certbot &>/dev/null; then
  echo "  Instalando Certbot..."
  sudo apt-get install -y -qq certbot python3-certbot-nginx
fi

# Escribir configuración de Nginx
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
sudo tee "$NGINX_CONF" > /dev/null <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    # Redirigir todo HTTP a HTTPS (Certbot lo reescribirá)
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    # Certbot rellenará estas rutas
    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # Frontend estático
    root $APP_DIR/client/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API y Socket.IO → backend Node
    location /socket.io/ {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX

sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Obtener certificado SSL si no existe
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "  Obteniendo certificado SSL con Certbot..."
  sudo certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email
fi

sudo nginx -t && sudo systemctl reload nginx
echo "  ✓  Nginx configurado con SSL"

# ── 6. Crear servicio systemd ──
echo "[6/6] Configurando servicio systemd..."

SERVICE_FILE="/etc/systemd/system/tabu.service"
sudo tee "$SERVICE_FILE" > /dev/null <<SERVICE
[Unit]
Description=Tabú Game Server
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR/server
ExecStart=$(command -v node) src/index.js
Restart=on-failure
RestartSec=5
EnvironmentFile=$APP_DIR/server/.env
User=$(whoami)

[Install]
WantedBy=multi-user.target
SERVICE

sudo systemctl daemon-reload
sudo systemctl enable tabu.service
sudo systemctl restart tabu.service
echo "  ✓  Servicio tabu.service activo"

echo ""
echo "═══════════════════════════════════"
echo "  ✓ Desplegado en https://$DOMAIN"
echo ""
echo "  Comandos útiles:"
echo "    sudo systemctl status tabu"
echo "    sudo journalctl -u tabu -f"
echo "    sudo systemctl restart tabu"
echo "═══════════════════════════════════"
