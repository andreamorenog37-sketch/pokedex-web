/**
 * Módulo de acceso a la PokéAPI
 * Responsabilidad: realizar consultas y normalizar datos
 */

const BASE_URL = 'https://pokeapi.co/api/v2';

/**
 * Obtiene una lista paginada de Pokémon
 * @param {number} limit 
 * @param {number} offset 
 * @returns {Promise<{count: number, results: Array}>}
 */
export async function fetchPokemonList(limit = 20, offset = 0) {
  const response = await fetch(`${BASE_URL}/pokemon?limit=${limit}&offset=${offset}`);
  if (!response.ok) {
    throw new Error(`Error al obtener lista: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Obtiene el detalle completo de un Pokémon por nombre o id
 * @param {string|number} nameOrId 
 * @returns {Promise<object>}
 */
export async function fetchPokemonDetail(nameOrId) {
  const response = await fetch(`${BASE_URL}/pokemon/${nameOrId}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Pokémon "${nameOrId}" no encontrado`);
    }
    throw new Error(`Error al obtener detalle: ${response.status}`);
  }
  return response.json();
}

/**
 * Normaliza los datos de un Pokémon para la tarjeta
 * @param {object} data - Respuesta cruda de la API
 * @returns {object}
 */
export function normalizePokemon(data) {
  const image =
    data.sprites?.other?.['official-artwork']?.front_default ||
    data.sprites?.other?.home?.front_default ||
    data.sprites?.front_default ||
    null;

  const cry =
    data.cries?.latest ||
    data.cries?.legacy ||
    null;

  const types = (data.types || []).map(t => t.type.name);

  return {
    id: data.id,
    name: data.name,
    image,
    cry,
    types,
    height: data.height,
    weight: data.weight
  };
}

/**
 * Carga detalles de varios Pokémon en paralelo (con límite de concurrencia simple)
 * @param {Array<{name: string, url: string}>} results 
 * @returns {Promise<Array>}
 */
export async function fetchMultipleDetails(results) {
  const promises = results.map(item =>
    fetchPokemonDetail(item.name)
      .then(normalizePokemon)
      .catch(err => ({
        id: null,
        name: item.name,
        image: null,
        cry: null,
        types: [],
        error: err.message
      }))
  );
  return Promise.all(promises);
}
