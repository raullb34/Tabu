# TABÚ — Juego Multijugador en Tiempo Real

Juego de Tabú multijugador con comunicación en tiempo real (WebSockets), integración con LLMs para generación de palabras, y dos temas visuales: **Hacker Naranja** (modo oscuro) y **Papertex** (modo claro).

---

## Estructura del Proyecto

```
Tabu/
├── server/                 # Backend Node.js
│   ├── .env.example        # Variables de entorno de ejemplo
│   ├── package.json
│   └── src/
│       ├── index.js        # Express + Socket.io
│       ├── game.js         # Lógica del juego y handlers WebSocket
│       └── llm.js          # Integración con OpenAI / Gemini
└── client/                 # Frontend React + Vite
    ├── index.html
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css        # Estilos Tailwind + temas
        ├── socket.js        # Cliente Socket.io
        ├── ThemeContext.jsx  # React Context para tema
        └── components/
            ├── Lobby.jsx       # Pantalla de lobby (crear/unirse)
            ├── GameRoom.jsx    # Pantalla principal del juego
            ├── TabooCard.jsx   # Tarjeta con palabra secreta y prohibidas
            ├── Chat.jsx        # Chat en tiempo real
            ├── PlayerList.jsx  # Lista de jugadores y puntuación
            ├── Timer.jsx       # Temporizador de ronda
            └── ThemeToggle.jsx # Switch de tema oscuro/claro
```

---

## Requisitos Previos

- **Node.js** v18 o superior
- **npm** v9 o superior
- (Opcional) Clave de API de **OpenAI** o **Google Gemini** para generación de palabras con IA

---

## Instalación y Ejecución

### 1. Clonar / Descargar el proyecto

```bash
cd Tabu
```

### 2. Configurar el Servidor

```bash
cd server
npm install
```

Crear el archivo `.env` a partir del ejemplo:

```bash
cp .env.example .env
```

Editar `.env` con tu configuración:

```env
# Proveedor de LLM: "openai" o "gemini"
LLM_PROVIDER=openai

# Clave de API de OpenAI
OPENAI_API_KEY=sk-tu-clave-aqui

# Clave de API de Gemini (alternativa)
GEMINI_API_KEY=tu-clave-gemini-aqui

# Puerto del servidor
PORT=3001

# URL del cliente (para CORS)
CLIENT_URL=http://localhost:5173
```

> **Nota:** Si no configuras una clave de API válida, el juego usará automáticamente un banco de palabras de respaldo integrado. El juego funciona sin LLM.

Iniciar el servidor:

```bash
# Modo desarrollo (con auto-reload)
npm run dev

# Modo producción
npm start
```

### 3. Configurar el Cliente

En otra terminal:

```bash
cd client
npm install
```

Iniciar el cliente:

```bash
npm run dev
```

El cliente se abrirá en **http://localhost:5173**.

---

## Cómo Jugar

### Crear una Sala
1. Ingresa tu nombre
2. Elige un nombre para la sala
3. Selecciona la dificultad (Fácil / Medio / Difícil)
4. Haz clic en **Crear Sala**
5. Comparte el código de 6 caracteres con otros jugadores

### Unirse a una Sala
1. Ingresa tu nombre
2. Ingresa el código de sala de 6 caracteres
3. Haz clic en **Unirse**

### Durante una Ronda
- Se necesitan **mínimo 2 jugadores** para empezar
- Un jugador es asignado como **Dador de Pistas**
- El **Dador** ve la palabra secreta y las palabras prohibidas
- El **Dador** escribe pistas en el chat sin usar las palabras prohibidas
- Los **Adivinadores** escriben sus intentos en el chat
- Cada ronda dura **90 segundos**

### Puntuación
| Evento | Puntos |
|--------|--------|
| Adivinador acierta | +2 pts (adivinador) |
| Dador exitoso | +1 pt (dador) |
| Dador dice palabra prohibida | -1 pt (dador) |
| Dador salta palabra | -1 pt (dador) |

### Dificultades
| Dificultad | Tipo de Palabra | Palabras Tabú |
|------------|-----------------|---------------|
| Fácil | Conceptos concretos | 3 palabras |
| Medio | Conceptos estándar | 5 palabras |
| Difícil | Conceptos abstractos/técnicos | 6 palabras |

---

## Temas Visuales

Usa el toggle en la esquina superior derecha para cambiar entre:

- **🖥 Modo Oscuro (Hacker Naranja):** Fondo negro, textos naranja neón, fuente monoespaciada, bordes con sombra de neón.
- **📜 Modo Claro (Papertex):** Fondo de papel pergamino, textos sepia/marrón, fuente tipo escritura a mano, bordes tipo boceto.

---

## Arquitectura Técnica

### Backend
- **Express** para endpoint de salud (`/health`)
- **Socket.io** para comunicación en tiempo real bidireccional
- **Módulo LLM** con soporte para OpenAI y Gemini, con fallback a banco de palabras local
- Validación de chat: detecta si el dador dice una palabra prohibida antes de retransmitir

### Frontend
- **React 18** con hooks para estado
- **Vite** como bundler
- **Tailwind CSS** con modo oscuro por clase (`darkMode: 'class'`)
- **Socket.io Client** para eventos WebSocket
- **React Context** para gestión de tema

### Eventos WebSocket

| Evento | Dirección | Descripción |
|--------|-----------|-------------|
| `room:create` | Cliente → Servidor | Crear nueva sala |
| `room:join` | Cliente → Servidor | Unirse a sala existente |
| `room:state` | Servidor → Cliente | Estado actualizado de la sala |
| `room:difficulty` | Cliente → Servidor | Cambiar dificultad |
| `round:start` | Cliente → Servidor | Solicitar inicio de ronda |
| `round:start-giver` | Servidor → Dador | Palabra secreta + prohibidas |
| `round:start-guesser` | Servidor → Adivinadores | Info de ronda |
| `round:timer` | Servidor → Todos | Timestamp de fin |
| `round:end` | Servidor → Todos | Resultado de la ronda |
| `round:skip` | Dador → Servidor | Saltar palabra |
| `chat:send` | Cliente → Servidor | Enviar mensaje |
| `chat:message` | Servidor → Todos | Mensaje del chat |
| `error:message` | Servidor → Cliente | Mensaje de error |

---

## Producción

Para construir el frontend para producción:

```bash
cd client
npm run build
```

Los archivos estáticos se generan en `client/dist/`. Puedes servirlos con cualquier servidor estático o configurar Express para servirlos.
