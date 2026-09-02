/**
 * Página de reconocimiento visual
 * - Acceso a cámara
 * - Reconocimiento con Teachable Machine
 * - Consulta a PokéAPI y presentación de tarjeta
 */
import { fetchPokemonDetail, normalizePokemon } from './api.js';

const video = document.getElementById('cameraVideo');
const canvas = document.getElementById('cameraCanvas');
const overlay = document.getElementById('cameraOverlay');
const startBtn = document.getElementById('startCameraBtn');
const stopBtn = document.getElementById('stopCameraBtn');
const captureBtn = document.getElementById('captureBtn');
const statusEl = document.getElementById('recogStatus');
const resultSection = document.getElementById('resultSection');

let stream = null;
let model = null;
let maxPredictions = 0;
let lastRecognizedId = null;
let isAnalyzing = false;
let currentAudio = null;

// URL de tu modelo de Teachable Machine
const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/aPTuB4C_v/';

// Los tres Pokémon que se pueden reconocer
const KNOWN_POKEMON = {
  'pikachu': 25,
  'charmander': 4,
  'bulbasaur': 1,
  'bulbasour':1,
  'chansey': 113
};

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (type ? ` ${type}` : '');
}

function showOverlay(text) {
  overlay.textContent = text;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

/**
 * Carga el modelo de Teachable Machine
 */
async function loadModel() {
  try {
    setStatus('Cargando modelo de reconocimiento...', 'loading');
    showOverlay('Cargando modelo...');

    const modelURL = MODEL_URL + 'model.json';
    const metadataURL = MODEL_URL + 'metadata.json';

    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    setStatus('Modelo cargado correctamente. Inicia la cámara.', 'success');
    showOverlay('Modelo listo. Inicia la cámara.');
    console.log('Clases del modelo:', model.getClassLabels());
    return true;
  } catch (err) {
    console.error('Error cargando modelo:', err);
    model = null;
    setStatus('No se pudo cargar el modelo. Revisa la URL de Teachable Machine.', 'error');
    showOverlay('Error al cargar el modelo');
    return false;
  }
}

async function startCamera() {
  if (!model) {
    setStatus('El modelo aún no está listo. Espera un momento...', 'error');
    return;
  }

  setStatus('Solicitando acceso a la cámara...', 'loading');
  showOverlay('Solicitando permiso...');

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Tu navegador no soporta acceso a la cámara');
    }

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    startBtn.disabled = true;
    stopBtn.disabled = false;
    captureBtn.disabled = false;
    hideOverlay();
    setStatus('Cámara lista. Apunta a un Pokémon y pulsa "Analizar imagen".', 'success');
  } catch (err) {
    console.error(err);
    let msg = 'No se pudo acceder a la cámara. ';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      msg += 'Permiso denegado. Revisa la configuración del navegador.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      msg += 'No se encontró ninguna cámara en este dispositivo.';
    } else {
      msg += err.message;
    }
    setStatus(msg, 'error');
    showOverlay(msg);
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  video.srcObject = null;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  captureBtn.disabled = true;
  showOverlay('Cámara detenida');
  setStatus('Cámara detenida.', '');
  lastRecognizedId = null;
}

/**
 * Analiza la imagen de la cámara
 */
async function analyzeImage() {
  if (isAnalyzing || !model || !stream) return;

  isAnalyzing = true;
  captureBtn.disabled = true;
  setStatus('Analizando imagen...', 'loading');

  try {
    const prediction = await model.predict(video);
    
    // Ordenar por mayor probabilidad
    prediction.sort((a, b) => b.probability - a.probability);
    
    const top = prediction[0];
    const label = top.className.toLowerCase().trim();
    const confidence = top.probability;

    console.log('Predicciones:', prediction);

    if (confidence < 0.70 || label === 'other' || label === 'fondo' || label === 'nada') {
      setStatus(`No se reconoció un Pokémon válido (${(confidence * 100).toFixed(1)}% - ${top.className})`, 'empty');
      resultSection.hidden = true;
      resultSection.innerHTML = '';
      lastRecognizedId = null;
    } else if (KNOWN_POKEMON[label]) {
      setStatus(`Detectado: ${label} (${(confidence * 100).toFixed(1)}%)`, 'success');
      await handleRecognitionResult(label);
    } else {
      setStatus(`Detectado "${top.className}" pero no está en la lista de Pokémon reconocibles.`, 'empty');
      resultSection.hidden = true;
      lastRecognizedId = null;
    }
  } catch (err) {
    console.error(err);
    setStatus(`Error en el reconocimiento: ${err.message}`, 'error');
  } finally {
    isAnalyzing = false;
    captureBtn.disabled = false;
  }
}

async function handleRecognitionResult(name) {
  const id = KNOWN_POKEMON[name];
  if (!id) return;

  // Evitar consultas repetidas
  if (lastRecognizedId === id) {
    setStatus(`Ya se mostró ${name}. Muestra otro Pokémon o reinicia la cámara.`, '');
    return;
  }

  setStatus(`Pokémon reconocido: ${name}. Consultando PokéAPI...`, 'loading');
  resultSection.hidden = false;
  resultSection.innerHTML = '<div class="pokemon-card skeleton skeleton-card" style="max-width:280px;margin:0 auto;"></div>';

  try {
    const data = await fetchPokemonDetail(id);
    const pokemon = normalizePokemon(data);
    lastRecognizedId = id;

    resultSection.innerHTML = '';
    const card = createResultCard(pokemon);
    resultSection.appendChild(card);
    setStatus(`¡${pokemon.name} reconocido correctamente!`, 'success');
  } catch (err) {
    console.error(err);
    resultSection.innerHTML = '';
    setStatus(`Error al consultar la PokéAPI: ${err.message}`, 'error');
    lastRecognizedId = null;
  }
}

function createResultCard(pokemon) {
  const card = document.createElement('article');
  card.className = 'pokemon-card';
  card.style.maxWidth = '320px';
  card.style.margin = '0 auto';

  const imageHtml = pokemon.image
    ? `<img src="${pokemon.image}" alt="${pokemon.name}" loading="lazy">`
    : `<span class="card-unavailable">Imagen no disponible</span>`;

  const typesHtml = (pokemon.types || [])
    .map(t => `<span class="type-badge type-${t}">${t}</span>`)
    .join('');

  const soundDisabled = !pokemon.cry ? 'disabled' : '';

  card.innerHTML = `
    <div style="text-align:center; padding-top: 0.75rem;">
      <span class="recognized-badge">✓ Reconocido por cámara</span>
    </div>
    <div class="card-image-wrap">
      <span class="card-id">#${String(pokemon.id).padStart(3, '0')}</span>
      ${imageHtml}
    </div>
    <div class="card-body">
      <h2 class="card-name">${pokemon.name}</h2>
      <div class="card-types">${typesHtml}</div>
      <button class="btn btn-sound" ${soundDisabled}>
        ${pokemon.cry ? '🔊 Escuchar grito' : '🔇 Sin sonido'}
      </button>
    </div>
  `;

  const soundBtn = card.querySelector('.btn-sound');
  if (pokemon.cry) {
    soundBtn.addEventListener('click', () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
        soundBtn.classList.remove('playing');
        soundBtn.innerHTML = '🔊 Escuchar grito';
        return;
      }
      const audio = new Audio(pokemon.cry);
      currentAudio = audio;
      soundBtn.classList.add('playing');
      soundBtn.innerHTML = '⏹ Detener';
      audio.play().catch(() => {
        soundBtn.classList.remove('playing');
        soundBtn.innerHTML = '🔊 Escuchar grito';
      });
      audio.onended = () => {
        soundBtn.classList.remove('playing');
        soundBtn.innerHTML = '🔊 Escuchar grito';
        currentAudio = null;
      };
    });
  }

  return card;
}

// Eventos
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
captureBtn.addEventListener('click', analyzeImage);

// Cargar el modelo al iniciar
loadModel();