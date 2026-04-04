/* eslint max-len: ["error", { "code": 400 }] */
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
  if (dataType === "string" && (length ?? 99999) <= 8000){
    return `varchar(${length ?? (isPk ? 50 : 100)})`;
  } else if (dataType === "string" && (length ?? 99999) > 8000){
    return `TEXT`;
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
