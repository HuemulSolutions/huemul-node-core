/* eslint max-len: ["error", { "code": 400 }] */
//version 1.0.0 2026-08-16 SRODRIGUEZ - comparación de versiones x.y.z para decidir si un upgrade corresponde

/** Cantidad de segmentos que se comparan: major, minor, patch. */
const VERSION_SEGMENTS = 3;

/** Forma exacta exigida por isValidVersion: tres enteros no negativos separados por punto. */
const STRICT_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/**
 * Convierte una versión de texto en la tupla [major, minor, patch].
 *
 * Es deliberadamente tolerante: nunca lanza. Los segmentos que falten valen 0 (`"1.2"` se lee
 * como `1.2.0`), los que no sean numéricos valen 0, y `undefined`/`null`/vacío se leen como
 * `0.0.0`. Se descarta cualquier sufijo pre-release o de build (`"1.2.3-beta"` ≡ `"1.2.3"`).
 * @param {string} version texto de la versión
 * @return {number[]} tupla de VERSION_SEGMENTS enteros
 */
function parseVersion(version: string): number[] {
  const raw = (version ?? "").trim();
  // se corta en el primer '-' o '+' para ignorar sufijos pre-release / build metadata
  const core = raw.split(/[-+]/)[0] ?? "";
  const parts = core.split(".");

  const result: number[] = [];
  for (let i = 0; i < VERSION_SEGMENTS; i++) {
    const value = Number.parseInt((parts[i] ?? "").trim(), 10);
    result.push(Number.isFinite(value) && value >= 0 ? value : 0);
  }

  return result;
}

/**
 * true si el texto tiene exactamente la forma x.y.z con enteros no negativos (ej. "1.3.0").
 *
 * A diferencia de compareVersions, esta función NO es tolerante: rechaza versiones parciales
 * ("1.2"), con sufijo ("1.2.3-beta") o no numéricas ("1.x.3"). Es la que se usa para validar
 * antes de guardar una versión en base de datos.
 * @param {string} version texto de la versión
 * @return {boolean}
 */
export function isValidVersion(version: string): boolean {
  return STRICT_VERSION_PATTERN.test((version ?? "").trim());
}

/**
 * Compara dos versiones x.y.z segmento a segmento y en forma numérica (no lexicográfica): por
 * eso "1.10.0" es mayor que "1.9.0". Nunca lanza; ver parseVersion para el detalle de cómo se
 * normaliza una entrada vacía o mal formada.
 * @param {string} version primera versión
 * @param {string} otherVersion segunda versión
 * @return {-1 | 0 | 1} -1 si version < otherVersion, 0 si son iguales, 1 si version > otherVersion
 */
export function compareVersions(version: string, otherVersion: string): -1 | 0 | 1 {
  const left = parseVersion(version);
  const right = parseVersion(otherVersion);

  for (let i = 0; i < VERSION_SEGMENTS; i++) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }

  return 0;
}

/**
 * true si `version` es estrictamente mayor que `otherVersion`. Pensada para decidir si un
 * release debe ejecutarse: isVersionGreaterThan(release, ultimaVersionAplicada).
 * @param {string} version versión a evaluar
 * @param {string} otherVersion versión de referencia
 * @return {boolean}
 */
export function isVersionGreaterThan(version: string, otherVersion: string): boolean {
  return compareVersions(version, otherVersion) === 1;
}
