/**
 * RUT chileno: normalizar, calcular y validar el digito verificador, y comparar.
 *
 * Es la unica implementacion para todos los proyectos Huemul: antes habia una en
 * huemul-node-read-docs (parseRut, isValidRut), otra en huemul-node-sii (calcularDV, dvValido) y
 * otra en gestion-costo-backend (dniCleanCL), con reglas levemente distintas.
 */

/**
 * Normaliza un RUT a la forma `12345678-K`: sin puntos, espacios ni guiones, sin ceros a la
 * izquierda, con el verificador en mayuscula y separado por un guion. No valida el verificador
 * (eso es rutIsValid): un RUT mal escrito se normaliza igual, porque la forma y la validez son dos
 * hallazgos distintos. Un valor vacio da "".
 * @param {string | null | undefined} value RUT en cualquier formato ("76.123.456-k", "076123456K"...)
 * @return {string} RUT normalizado
 */
export function rutNormalize(value: string | null | undefined): string {
  const clean = String(value ?? "")
    .replace(/[^0-9a-z]/gi, "")
    .replace(/^0+/, "")
    .toUpperCase();
  if (clean.length <= 1) return clean;
  return `${clean.substring(0, clean.length - 1)}-${clean.substring(clean.length - 1)}`;
}

/**
 * Digito verificador de un RUT (modulo 11, serie 2 a 7).
 * @param {number | string} body cuerpo del RUT, sin verificador (se ignora lo que no sea digito)
 * @return {string} "0" a "9" o "K"
 */
export function rutCheckDigit(body: number | string): string {
  const digits = String(body).replace(/\D/g, "");
  let sum = 0;
  let factor = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  if (rest === 11) return "0";
  if (rest === 10) return "K";
  return String(rest);
}

/**
 * Si un RUT tiene forma de RUT (hasta 9 digitos y verificador) y su verificador es correcto.
 * Acepta cualquier formato: se normaliza antes de validar.
 * @param {string | null | undefined} value RUT en cualquier formato
 * @return {boolean}
 */
export function rutIsValid(value: string | null | undefined): boolean {
  const rut = rutNormalize(value);
  const match = /^(\d{1,9})-([\dK])$/.exec(rut);
  return match !== null && rutCheckDigit(match[1]) === match[2];
}

/**
 * Si dos RUT son el mismo, sin importar el formato en que vengan ("76.123.456-K" y "76123456k" lo
 * son). Un RUT vacio no es igual a nada.
 * @param {string | null | undefined} a un RUT
 * @param {string | null | undefined} b otro RUT
 * @return {boolean}
 */
export function rutEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = rutNormalize(a);
  return left !== "" && left === rutNormalize(b);
}
