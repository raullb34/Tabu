/**
 * Módulo de integración con LLM para generar conjuntos de Tabú.
 * Soporta OpenAI y Gemini.
 */

const SYSTEM_PROMPT = `Actúa como un generador de datos para el juego Tabú en español. Genera una palabra secreta y una lista de palabras prohibidas basadas en la dificultad indicada. Sigue estas reglas:
- 'Fácil': Conceptos muy concretos y obvios. 3 palabras tabú muy comunes.
- 'Medio': Conceptos estándar. 5 palabras tabú estándar.
- 'Difícil': Conceptos abstractos o técnicos. 6 palabras tabú que restrinjan sinónimos comunes y técnicos.
Tu respuesta debe ser estrictamente un objeto JSON puro, sin texto adicional ni bloques de código:
{"word": "...", "taboo": ["...", "...", "..."]}`;

function buildExclusionNote(usedWords) {
  if (!usedWords || usedWords.size === 0) return '';
  const list = [...usedWords].join(', ');
  return `\nIMPORTANTE: NO uses ninguna de estas palabras como palabra secreta porque ya se han jugado: ${list}`;
}

/**
 * Genera un set de Tabú usando OpenAI
 */
async function generateWithOpenAI(difficulty, usedWords) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'sk-your-key-here') {
    return getFallbackSet(difficulty, usedWords);
  }

  const exclusion = buildExclusionNote(usedWords);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + exclusion },
        { role: 'user', content: `Dificultad: ${difficulty}` },
      ],
      temperature: 0.9,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    console.error('[LLM] Error OpenAI:', response.status);
    return getFallbackSet(difficulty, usedWords);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  return parseLLMResponse(content, difficulty, usedWords);
}

/**
 * Genera un set de Tabú usando Gemini
 */
async function generateWithGemini(difficulty, usedWords) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-key-here') {
    return getFallbackSet(difficulty, usedWords);
  }

  const exclusion = buildExclusionNote(usedWords);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${SYSTEM_PROMPT}${exclusion}\n\nDificultad: ${difficulty}` },
          ],
        },
      ],
      generationConfig: { temperature: 0.9, maxOutputTokens: 200 },
    }),
  });

  if (response.status === 429) {
    console.warn('[LLM] Gemini rate-limited, reintentando en 2s...');
    await new Promise((r) => setTimeout(r, 2000));
    const retry = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}${exclusion}\n\nDificultad: ${difficulty}` }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 200 },
      }),
    });
    if (retry.ok) {
      const retryData = await retry.json();
      const retryContent = retryData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return parseLLMResponse(retryContent, difficulty, usedWords);
    }
  }

  if (!response.ok) {
    console.error('[LLM] Error Gemini:', response.status);
    return getFallbackSet(difficulty, usedWords);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return parseLLMResponse(content, difficulty, usedWords);
}

/**
 * Parsea la respuesta del LLM y la valida
 */
function parseLLMResponse(content, difficulty, usedWords) {
  try {
    // Limpiar posibles backticks de markdown
    const cleaned = content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (
      typeof parsed.word === 'string' &&
      Array.isArray(parsed.taboo) &&
      parsed.taboo.length > 0
    ) {
      const word = parsed.word.toUpperCase();
      // Si el LLM devolvió una palabra ya usada, intentar con fallback
      if (usedWords && usedWords.has(word)) {
        console.warn(`[LLM] Palabra repetida del LLM: ${word}, usando fallback`);
        return getFallbackSet(difficulty, usedWords);
      }
      return {
        word,
        taboo: parsed.taboo.map((w) => w.toUpperCase()),
      };
    }
  } catch (e) {
    console.error('[LLM] Error parseando respuesta:', e.message);
  }
  return getFallbackSet(difficulty, usedWords);
}

/* ────────────────── Banco de palabras de respaldo ────────────────── */

const FALLBACK_WORDS = {
  Fácil: [
    { word: 'PERRO', taboo: ['ANIMAL', 'MASCOTA', 'LADRAR'] },
    { word: 'SOL', taboo: ['ESTRELLA', 'LUZ', 'CALOR'] },
    { word: 'PIZZA', taboo: ['COMIDA', 'ITALIA', 'QUESO'] },
    { word: 'PLAYA', taboo: ['ARENA', 'MAR', 'VACACIONES'] },
    { word: 'GUITARRA', taboo: ['MÚSICA', 'CUERDAS', 'INSTRUMENTO'] },
    { word: 'LIBRO', taboo: ['LEER', 'PÁGINAS', 'ESTUDIAR'] },
    { word: 'GATO', taboo: ['ANIMAL', 'MASCOTA', 'MAULLAR'] },
    { word: 'AVIÓN', taboo: ['VOLAR', 'CIELO', 'VIAJE'] },
    { word: 'CHOCOLATE', taboo: ['DULCE', 'CACAO', 'POSTRE'] },
    { word: 'FÚTBOL', taboo: ['DEPORTE', 'BALÓN', 'GOL'] },
    { word: 'RELOJ', taboo: ['HORA', 'TIEMPO', 'PULSERA'] },
    { word: 'HOSPITAL', taboo: ['MÉDICO', 'ENFERMO', 'SALUD'] },
    { word: 'COCHE', taboo: ['VEHÍCULO', 'RUEDAS', 'CONDUCIR'] },
    { word: 'HELADO', taboo: ['FRÍO', 'DULCE', 'VERANO'] },
    { word: 'TELÉFONO', taboo: ['LLAMAR', 'MÓVIL', 'HABLAR'] },
  ],
  Medio: [
    { word: 'ALGORITMO', taboo: ['PROGRAMA', 'CÓDIGO', 'PASOS', 'COMPUTADORA', 'LÓGICA'] },
    { word: 'DEMOCRACIA', taboo: ['VOTAR', 'GOBIERNO', 'PUEBLO', 'ELECCIONES', 'POLÍTICA'] },
    { word: 'FOTOGRAFÍA', taboo: ['CÁMARA', 'IMAGEN', 'FOTO', 'CAPTURAR', 'RECUERDO'] },
    { word: 'EVOLUCIÓN', taboo: ['DARWIN', 'CAMBIO', 'ESPECIE', 'ADAPTACIÓN', 'NATURAL'] },
    { word: 'GRAVEDAD', taboo: ['CAER', 'NEWTON', 'PESO', 'FUERZA', 'TIERRA'] },
    { word: 'INFLACIÓN', taboo: ['PRECIO', 'DINERO', 'ECONOMÍA', 'SUBIR', 'MONEDA'] },
    { word: 'TERREMOTO', taboo: ['TIERRA', 'TEMBLOR', 'RICHTER', 'SISMO', 'PLACA'] },
    { word: 'SINFONÍA', taboo: ['MÚSICA', 'ORQUESTA', 'BEETHOVEN', 'CLÁSICA', 'MOVIMIENTO'] },
    { word: 'GALAXIA', taboo: ['ESTRELLAS', 'UNIVERSO', 'VÍA LÁCTEA', 'ESPACIO', 'PLANETAS'] },
    { word: 'VACUNA', taboo: ['INYECCIÓN', 'VIRUS', 'PROTECCIÓN', 'ENFERMEDAD', 'INMUNE'] },
  ],
  Difícil: [
    { word: 'ENTROPÍA', taboo: ['DESORDEN', 'TERMODINÁMICA', 'ENERGÍA', 'CAOS', 'SISTEMA', 'FÍSICA'] },
    { word: 'SINERGIA', taboo: ['CONJUNTO', 'COLABORACIÓN', 'SUMA', 'EQUIPO', 'EFECTO', 'COOPERACIÓN'] },
    { word: 'PARADIGMA', taboo: ['MODELO', 'EJEMPLO', 'PATRÓN', 'CAMBIO', 'CIENCIA', 'ESQUEMA'] },
    { word: 'RESILIENCIA', taboo: ['SUPERAR', 'ADVERSIDAD', 'FUERZA', 'RECUPERAR', 'RESISTIR', 'ADAPTARSE'] },
    { word: 'EPISTEMOLOGÍA', taboo: ['CONOCIMIENTO', 'FILOSOFÍA', 'SABER', 'CIENCIA', 'VERDAD', 'MÉTODO'] },
    { word: 'BLOCKCHAIN', taboo: ['CADENA', 'BITCOIN', 'CRIPTOMONEDA', 'BLOQUES', 'DESCENTRALIZADO', 'REGISTRO'] },
    { word: 'METÁFORA', taboo: ['FIGURA', 'LITERARIA', 'COMPARACIÓN', 'LENGUAJE', 'RECURSO', 'SÍMBOLO'] },
    { word: 'PRAGMÁTICO', taboo: ['PRÁCTICO', 'REALISTA', 'ÚTIL', 'FUNCIONAL', 'EFICIENTE', 'CONCRETO'] },
  ],
};

function getFallbackSet(difficulty, usedWords) {
  const pool = FALLBACK_WORDS[difficulty] || FALLBACK_WORDS['Medio'];
  // Filtrar palabras ya usadas
  let available = pool;
  if (usedWords && usedWords.size > 0) {
    available = pool.filter((entry) => !usedWords.has(entry.word.toUpperCase()));
  }
  // Si se agotaron todas, reiniciar (permitir repetición)
  if (available.length === 0) {
    console.warn('[Fallback] Todas las palabras usadas, reiniciando pool');
    available = pool;
  }
  const idx = Math.floor(Math.random() * available.length);
  return { ...available[idx] };
}

/* ────────────────── API pública ────────────────── */

export async function generateTabooSet(difficulty = 'Medio', usedWords = null) {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  try {
    if (provider === 'gemini') {
      return await generateWithGemini(difficulty, usedWords);
    }
    return await generateWithOpenAI(difficulty, usedWords);
  } catch (err) {
    console.error('[LLM] Error general:', err.message);
    return getFallbackSet(difficulty, usedWords);
  }
}
