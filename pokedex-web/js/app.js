/**
 * Lógica principal del catálogo de Pokémon
 */
import {
  fetchPokemonList,
  fetchMultipleDetails,
  fetchPokemonDetail,
  normalizePokemon
} from './api.js';

const grid = document.getElementById('pokemonGrid');
const statusEl = document.getElementById('status');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const limitSelect = document.getElementById('limitSelect');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const pageInfo = document.getElementById('pageInfo');

let currentOffset = 0;
let currentLimit = 20;
let totalCount = 0;
let currentAudio = null;

function setStatus(message, type = '') {
  statusEl.textContent = message;
  statusEl.className = 'status' + (type ? ` ${type}` : '');
}

function clearStatus() {
  statusEl.textContent = '';
  statusEl.className = 'status';
}

function createSkeletonCards(count) {
  grid.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const sk = document.createElement('div');
    sk.className = 'pokemon-card skeleton skeleton-card';
    grid.appendChild(sk);
  }
}

function createCard(pokemon) {
  const card = document.createElement('article');
  card.className = 'pokemon-card';
  card.setAttribute('data-id', pokemon.id || '');

  const imageHtml = pokemon.image
    ? `<img src="${pokemon.image}" alt="${pokemon.name}" loading="lazy" onerror="this.src=''; this.alt='Imagen no disponible'; this.parentElement.insertAdjacentHTML('beforeend','<span class=\\'card-unavailable\\'>Imagen no disponible</span>');">`
    : `<span class="card-unavailable">Imagen no disponible</span>`;

  const typesHtml = pokemon.types && pokemon.types.length
    ? pokemon.types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join('')
    : '';

  const soundDisabled = !pokemon.cry ? 'disabled' : '';
  const soundLabel = pokemon.cry ? '🔊 Escuchar grito' : '🔇 Sin sonido';

  card.innerHTML = `
    <div class="card-image-wrap">
      ${pokemon.id ? `<span class="card-id">#${String(pokemon.id).padStart(3, '0')}</span>` : ''}
      ${imageHtml}
    </div>
    <div class="card-body">
      <h2 class="card-name">${pokemon.name || 'Desconocido'}</h2>
      <div class="card-types">${typesHtml}</div>
      ${pokemon.error ? `<p class="card-unavailable">${pokemon.error}</p>` : ''}
      <button class="btn btn-sound" data-cry="${pokemon.cry || ''}" ${soundDisabled} aria-label="Reproducir grito de ${pokemon.name}">
        ${soundLabel}
      </button>
    </div>
  `;

  const soundBtn = card.querySelector('.btn-sound');
  if (pokemon.cry) {
    soundBtn.addEventListener('click', () => playCry(pokemon.cry, soundBtn));
  }

  return card;
}

function playCry(url, button) {
  // Detener audio anterior si existe
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    document.querySelectorAll('.btn-sound.playing').forEach(b => {
      b.classList.remove('playing');
      b.innerHTML = '🔊 Escuchar grito';
    });
  }

  const audio = new Audio(url);
  currentAudio = audio;
  button.classList.add('playing');
  button.innerHTML = '⏹ Detener';

  audio.play().catch(err => {
    console.warn('No se pudo reproducir el audio:', err);
    setStatus('No se pudo reproducir el sonido', 'error');
    button.classList.remove('playing');
    button.innerHTML = '🔊 Escuchar grito';
  });

  audio.onended = () => {
    button.classList.remove('playing');
    button.innerHTML = '🔊 Escuchar grito';
    currentAudio = null;
  };

  // Toggle: si se vuelve a pulsar, detiene
  const stopHandler = () => {
    if (currentAudio === audio) {
      audio.pause();
      audio.currentTime = 0;
      button.classList.remove('playing');
      button.innerHTML = '🔊 Escuchar grito';
      currentAudio = null;
      button.removeEventListener('click', stopHandler);
    }
  };
  // Reemplazar temporalmente el listener es complicado; usamos un flag simple
  button.onclick = () => {
    if (button.classList.contains('playing')) {
      stopHandler();
    } else {
      playCry(url, button);
    }
  };
}

function renderCards(pokemonList) {
  grid.innerHTML = '';
  if (!pokemonList || pokemonList.length === 0) {
    setStatus('No se encontraron Pokémon', 'empty');
    return;
  }
  pokemonList.forEach(p => {
    grid.appendChild(createCard(p));
  });
}

function updatePagination() {
  const page = Math.floor(currentOffset / currentLimit) + 1;
  const totalPages = Math.ceil(totalCount / currentLimit) || 1;
  pageInfo.textContent = `Página ${page} de ${totalPages}`;
  prevBtn.disabled = currentOffset <= 0;
  nextBtn.disabled = currentOffset + currentLimit >= totalCount;
}

async function loadPokemonList() {
  setStatus('Cargando Pokémon...', 'loading');
  createSkeletonCards(currentLimit);

  try {
    const listData = await fetchPokemonList(currentLimit, currentOffset);
    totalCount = listData.count;

    const details = await fetchMultipleDetails(listData.results);
    clearStatus();
    renderCards(details);
    updatePagination();
  } catch (err) {
    console.error(err);
    grid.innerHTML = '';
    setStatus(`Error al cargar datos: ${err.message}. Intenta de nuevo.`, 'error');
  }
}

async function searchPokemon() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    currentOffset = 0;
    await loadPokemonList();
    return;
  }

  setStatus(`Buscando "${query}"...`, 'loading');
  createSkeletonCards(1);

  try {
    const data = await fetchPokemonDetail(query);
    const normalized = normalizePokemon(data);
    clearStatus();
    renderCards([normalized]);
    // Ocultar paginación en búsqueda
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    pageInfo.textContent = 'Resultado de búsqueda';
  } catch (err) {
    grid.innerHTML = '';
    setStatus(err.message || 'No se encontró el Pokémon', 'error');
  }
}

// Event listeners
searchBtn.addEventListener('click', searchPokemon);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchPokemon();
});

limitSelect.addEventListener('change', () => {
  currentLimit = parseInt(limitSelect.value, 10);
  currentOffset = 0;
  loadPokemonList();
});

prevBtn.addEventListener('click', () => {
  currentOffset = Math.max(0, currentOffset - currentLimit);
  loadPokemonList();
});

nextBtn.addEventListener('click', () => {
  currentOffset += currentLimit;
  loadPokemonList();
});

// Carga inicial
loadPokemonList();
