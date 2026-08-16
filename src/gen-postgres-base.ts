/* eslint max-len: ["error", { "code": 400 }] */
//version 1.0.2 2026-08-16 SRODRIGUEZ - string sin columnLength vuelve a ser varchar(100)/varchar(50); rama text explícita
//version 1.0.1 2023-01-04 SRODRIGUEZ
/**
     *
     * @param {string} dataType
     * @param {number} length
     * @param {number} precision
     * @param {boolean} isPk
     * @return {string}
     */
export function dataTypeToPostgres(dataType: string, length?: number, precision?: number, isPk?: boolean): string {
  if (dataType.toUpperCase() === "text".toUpperCase()) {
    // tipo declarable para texto largo: antes solo funcionaba por el passthrough del else final
    return "TEXT";
  } else if (dataType === "string") {
    // un length ausente o 0 significa "el default": varchar(100), o varchar(50) si es PK.
    // La versión anterior convertía el ausente en 99999 y caía SIEMPRE en TEXT, dejando este
    // fallback inalcanzable; length 0 además producía varchar(0), que es SQL inválido.
    const len = (length ?? 0) > 0 ? (length as number) : (isPk ? 50 : 100);
    return len > 8000 ? "TEXT" : `varchar(${len})`;
  } else if (dataType.toUpperCase() === "boolean".toUpperCase()) {
    return "boolean";
  } else if (dataType.toUpperCase() === "Date".toUpperCase() && ((length ?? 0) >= 40 || (length ?? 0) === 0)) {
    return "varchar(40)";
  } else if (dataType.toUpperCase() === "Date".toUpperCase() && (length ?? 0) > 0) {
    return `varchar(${length})`;
  } else if (dataType.toUpperCase() === "VECTOR".toUpperCase()) {
    return `VECTOR(${length == 1024})`;
  } else if (dataType.toUpperCase() === "Time".toUpperCase()) {
    return "time";
  } else if (dataType.toUpperCase() === "timestamptz".toUpperCase()) {
    return "timestamptz";
  } else if (dataType.toUpperCase() === "number".toUpperCase() && (precision ?? 0) === 0) {
    return "INT";
  } else if (dataType.toUpperCase() === "number".toUpperCase()) {
    return `NUMERIC(${(length ?? 0) === 0 ? 15 : length}, ${(precision ?? 0) === 0 ? 2 : precision})`;
  } else if (dataType.toUpperCase() === "file".toUpperCase() || dataType.toUpperCase() === "image".toUpperCase()) {
    return "varchar(100)";
  } else if (dataType.toUpperCase() === "picker".toUpperCase()) {
    return `varchar(${length ?? (20)})`;
  } else if (dataType.toUpperCase() === "color".toUpperCase()) {
    return "varchar(10)";
  } else {
    return dataType;
  }
}
