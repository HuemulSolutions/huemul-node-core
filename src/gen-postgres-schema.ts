/* eslint max-len: ["error", { "code": 400 }] */
//version 1.0.2 2026-08-03 SRODRIGUEZ - escape de identificadores y literales + validación de identificadores y tipos
//version 1.0.1 2026-08-03 SRODRIGUEZ - defaults por expresión SQL + validación de defaults
//version 1.0.0 2026-07-16 SRODRIGUEZ - motor de sincronización de esquema (diff modelo vs BD real) + generación de ALTER/CREATE, puro (sin dependencia de knex/pg)
import { dataTypeToPostgres } from "./gen-postgres-base";
import { IHuemulColumnDef } from "./interfaces/interface-huemul-column-def";

/**
 * Fila normalizada de information_schema.columns (una columna real en la BD).
 */
export interface ISchemaColumn {
  columnName: string,
  dataType: string,
  characterMaximumLength: number | null,
  numericPrecision: number | null,
  numericScale: number | null,
  isNullable: boolean,
}

/**
 * Representación canónica de un tipo PostgreSQL, comparable entre el tipo esperado
 * (derivado del modelo vía dataTypeToPostgres) y el tipo real (information_schema).
 */
export interface ICanonicalType {
  base: string,
  length?: number,
  precision?: number,
  scale?: number,
}

/**
 * Diferencia detectada en una columna al comparar modelo vs BD real.
 * kind: 'add' = falta en la BD; 'alter' = existe pero difiere el tipo; 'extra' = está en la BD pero no en el modelo.
 */
export interface IColumnDiff {
  columnName: string,
  kind: "add" | "alter" | "extra",
  expectedType?: string,
  actualType?: string,
  allowNull?: boolean,
}

/**
 * Resultado del diff de una tabla (sin ejecutar nada).
 */
export interface ITableSchemaDiff {
  tableName: string,
  tableMissing: boolean,
  toAdd: IHuemulColumnDef[],
  toAlter: IColumnDiff[],
  extra: string[],
}

/**
 * Resultado de sincronizar una tabla (evaluación o aplicación).
 * En modo evaluación (applyChanges=false), added/typeChanged listan lo que se haría y sql[] las sentencias sugeridas.
 * En modo aplicación (applyChanges=true), added/typeChanged listan lo efectivamente aplicado y errors[] los fallos.
 */
export interface ITableSyncResult {
  tableName: string,
  tableMissing: boolean,
  added: string[],
  typeChanged: string[],
  extra: string[],
  errors: string[],
  sql: string[],
}

/**
 * Módulo a sincronizar: metadata de columnas + nombre de tabla.
 */
export interface ISyncModule {
  columnsInfo: IHuemulColumnDef[],
  tableName: string,
}

/**
 * Opciones de sincronización.
 * applyChanges: false (default) solo evalúa/reporta; true ejecuta los cambios vía el runner.
 * applyTypeChanges: true (default) incluye los ALTER COLUMN ... TYPE; false los omite (solo agrega columnas faltantes).
 */
export interface ISchemaSyncOptions {
  applyChanges?: boolean,
  applyTypeChanges?: boolean,
}

/**
 * Ejecutor de SQL inyectado por el consumidor. Para SELECT devuelve las filas; para DDL puede devolver [].
 * Ej. en el app: (sql) => (await dbConnection.raw(sql)).rows ?? []
 */
export type SqlRunner = (sql: string) => Promise<Record<string, unknown>[]>;

/**
 * true si el pkType corresponde a una PK (manual o autoincremental).
 * @param {string} pkType
 * @return {boolean}
 */
function isPk(pkType: string): boolean {
  return pkType === "autoIncPK" || pkType === "manualPK";
}

/**
 * Cita un identificador PostgreSQL (tabla/columna) duplicando las comillas dobles internas, que es
 * la forma en que PG escapa `"` dentro de un identificador citado. Elimina NUL, que PG no acepta en
 * ningún caso. Es defensa en profundidad: `validateIdentifier` además reporta estos casos como
 * metadata inválida. No lanza, para no romper el contrato "no lanza" de `syncTableSchema`.
 * @param {string} name
 * @return {string} el identificador citado, listo para interpolar
 */
export function quoteIdent(name: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = String(name ?? "").replace(/\0/g, "");
  return `"${clean.replace(/"/g, "\"\"")}"`;
}

/**
 * Escapa un valor para usarlo como literal de string SQL, duplicando las comillas simples. Es el
 * escape correcto y completo con `standard_conforming_strings = on` (default en PostgreSQL desde 9.1),
 * donde el backslash no tiene significado especial. Devuelve el contenido SIN las comillas externas.
 * @param {string} value
 * @return {string}
 */
export function escapeSqlLiteral(value: string): string {
  // eslint-disable-next-line no-control-regex
  return String(value ?? "").replace(/\0/g, "").replace(/'/g, "''");
}

/**
 * Normaliza sinónimos de tipos PostgreSQL a una base canónica (la misma que reporta information_schema.data_type).
 * @param {string} base
 * @return {string}
 */
function normalizeBase(base: string): string {
  switch (base) {
    case "varchar":
    case "character varying": return "character varying";
    case "char":
    case "character": return "character";
    case "int":
    case "int4":
    case "integer": return "integer";
    case "int8":
    case "bigint": return "bigint";
    case "int2":
    case "smallint": return "smallint";
    case "numeric":
    case "decimal": return "numeric";
    case "bool":
    case "boolean": return "boolean";
    case "timestamptz":
    case "timestamp with time zone": return "timestamp with time zone";
    case "timestamp":
    case "timestamp without time zone": return "timestamp without time zone";
    case "timetz":
    case "time with time zone": return "time with time zone";
    case "time":
    case "time without time zone": return "time without time zone";
    default: return base;
  }
}

/**
 * Parsea la salida de dataTypeToPostgres (ej. "varchar(120)", "NUMERIC(19, 4)", "INT", "TimeStamp", "jsonb")
 * a una forma canónica comparable. Tolerante a mayúsculas/espacios.
 * @param {string} typeStr
 * @return {ICanonicalType}
 */
export function parsePostgresType(typeStr: string): ICanonicalType {
  const raw = (typeStr ?? "").trim();
  const match = raw.match(/^([A-Za-z0-9_ ]+?)\s*(?:\(([^)]*)\))?$/);
  const base = normalizeBase((match ? match[1] : raw).trim().toLowerCase());
  const argsStr = match && match[2] ? match[2] : "";
  const args = argsStr.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

  const result: ICanonicalType = {base};
  if (base === "character varying" && args.length >= 1) {
    const len = parseInt(args[0], 10);
    if (!Number.isNaN(len)) result.length = len;
  } else if (base === "numeric" && args.length >= 1) {
    const prec = parseInt(args[0], 10);
    if (!Number.isNaN(prec)) result.precision = prec;
    result.scale = args.length >= 2 ? (parseInt(args[1], 10) || 0) : 0;
  }
  return result;
}

/**
 * Tipo PostgreSQL esperado para una columna del modelo (misma regla que usa el CREATE TABLE).
 * @param {IHuemulColumnDef} col
 * @return {string}
 */
export function columnPostgresType(col: IHuemulColumnDef): string {
  return dataTypeToPostgres(col.columnType, col.columnLength, col.columnPrecision, isPk(col.pkType));
}

/**
 * Forma canónica del tipo esperado de una columna del modelo.
 * @param {IHuemulColumnDef} col
 * @return {ICanonicalType}
 */
export function canonicalFromColumnDef(col: IHuemulColumnDef): ICanonicalType {
  return parsePostgresType(columnPostgresType(col));
}

/**
 * Forma canónica del tipo real de una columna leída de information_schema.
 * @param {ISchemaColumn} row
 * @return {ICanonicalType}
 */
export function canonicalFromInformationSchema(row: ISchemaColumn): ICanonicalType {
  const base = normalizeBase((row.dataType ?? "").trim().toLowerCase());
  const result: ICanonicalType = {base};
  if (base === "character varying" && row.characterMaximumLength != null) {
    result.length = row.characterMaximumLength;
  } else if (base === "numeric" && row.numericPrecision != null) {
    result.precision = row.numericPrecision;
    result.scale = row.numericScale ?? 0;
  }
  return result;
}

/**
 * true si ambos tipos canónicos son equivalentes.
 * character varying compara longitud; numeric compara precisión+escala; el resto basta con la base.
 * @param {ICanonicalType} a
 * @param {ICanonicalType} b
 * @return {boolean}
 */
export function typesMatch(a: ICanonicalType, b: ICanonicalType): boolean {
  if (a.base !== b.base) return false;
  if (a.base === "character varying") return (a.length ?? null) === (b.length ?? null);
  if (a.base === "numeric") return (a.precision ?? null) === (b.precision ?? null) && (a.scale ?? 0) === (b.scale ?? 0);
  return true;
}

/**
 * SQL de introspección: columnas reales de una tabla (esquema public). Alias en camelCase para mapear a ISchemaColumn.
 * El tableName va escapado como literal: sin eso, un `'` en el nombre cierra el literal y — como el
 * runner suele ser `raw()`, que acepta múltiples sentencias separadas por `;` — habilita ejecución
 * arbitraria. Los identificadores son case-sensitive.
 * @param {string} tableName
 * @return {string}
 */
export function informationSchemaColumnsSql(tableName: string): string {
  return `SELECT column_name AS "columnName", data_type AS "dataType", ` +
    `character_maximum_length AS "characterMaximumLength", numeric_precision AS "numericPrecision", ` +
    `numeric_scale AS "numericScale", is_nullable AS "isNullable" ` +
    `FROM information_schema.columns ` +
    `WHERE table_name = '${escapeSqlLiteral(tableName)}' AND table_schema = 'public'`;
}

/**
 * Convierte un valor a number o null.
 * @param {unknown} v
 * @return {number | null}
 */
function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * Normaliza una fila cruda del runner a ISchemaColumn (acepta claves camelCase o snake_case).
 * @param {Record<string, unknown>} row
 * @return {ISchemaColumn}
 */
export function toSchemaColumn(row: Record<string, unknown>): ISchemaColumn {
  const get = (a: string, b: string): unknown => (row[a] !== undefined ? row[a] : row[b]);
  const nullable = get("isNullable", "is_nullable");
  return {
    columnName: String(get("columnName", "column_name") ?? ""),
    dataType: String(get("dataType", "data_type") ?? ""),
    characterMaximumLength: numOrNull(get("characterMaximumLength", "character_maximum_length")),
    numericPrecision: numOrNull(get("numericPrecision", "numeric_precision")),
    numericScale: numOrNull(get("numericScale", "numeric_scale")),
    isNullable: typeof nullable === "boolean" ? nullable : String(nullable).toUpperCase() === "YES",
  };
}

/**
 * Descripción legible del tipo real de una columna (para el reporte).
 * @param {ISchemaColumn} row
 * @return {string}
 */
function describeActual(row: ISchemaColumn): string {
  if (row.characterMaximumLength != null) return `${row.dataType}(${row.characterMaximumLength})`;
  if (row.numericPrecision != null) return `${row.dataType}(${row.numericPrecision},${row.numericScale ?? 0})`;
  return row.dataType;
}

/**
 * Expresión SQL por defecto declarada en el modelo (`defaultSql`), ya normalizada, o "" si no hay.
 * @param {IHuemulColumnDef} col
 * @return {string}
 */
function modelDefaultSql(col: IHuemulColumnDef): string {
  return (col.defaultSql ?? "").trim();
}

/**
 * true si la columna declara un valor literal por defecto. Compara con `!= null` (no truthiness)
 * para que `false` y `0` cuenten como defaults declarados; `null` se tolera en runtime como
 * "sin default" para metadata que venga de JSON/BD, aunque el tipo ya no lo admite.
 * @param {IHuemulColumnDef} col
 * @return {boolean}
 */
function hasModelDefaultValue(col: IHuemulColumnDef): boolean {
  return col.defaultValue != null;
}

/**
 * true si la columna declara un default en el modelo, sea literal (`defaultValue`) o expresión (`defaultSql`).
 * @param {IHuemulColumnDef} col
 * @return {boolean}
 */
function hasModelDefault(col: IHuemulColumnDef): boolean {
  return modelDefaultSql(col).length > 0 || hasModelDefaultValue(col);
}

/**
 * Fragmento SQL del valor por defecto de una columna, en orden de precedencia:
 * 1) `defaultSql` (expresión cruda, sin escapar, ej. `now()`); 2) `defaultValue` (literal escapado);
 * 3) fallback por `columnType`, para que un `ADD COLUMN ... NOT NULL` nunca falle sobre tablas con filas existentes.
 * @param {IHuemulColumnDef} col
 * @return {string}
 */
export function sqlDefaultLiteral(col: IHuemulColumnDef): string {
  const type = (col.columnType ?? "").toLowerCase();
  const expr = modelDefaultSql(col);
  if (expr.length > 0) return expr;
  if (hasModelDefaultValue(col)) {
    const v = col.defaultValue as string | number | boolean;
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    const escaped = `'${escapeSqlLiteral(String(v))}'`;
    return type === "jsonb" ? `${escaped}::jsonb` : escaped;
  }
  // fallback por tipo
  if (type === "number") return "0";
  if (type === "boolean") return "false";
  if (type === "jsonb") return "'{}'::jsonb";
  return "''";
}

/**
 * Valida que el default declarado en el modelo sea coherente con `columnType`, para detectar en modo
 * evaluación lo que de otro modo fallaría recién al ejecutar el DDL. No valida el contenido de
 * `defaultSql` (es SQL crudo por diseño), solo que no venga en blanco.
 * @param {IHuemulColumnDef} col
 * @return {string | null} mensaje del problema, o null si el default es válido (o si no hay default)
 */
export function validateColumnDefault(col: IHuemulColumnDef): string | null {
  const name = col.columnName;
  const hasSql = (col.defaultSql ?? "").length > 0;
  if (hasSql && modelDefaultSql(col).length === 0) {
    return `${name}: defaultSql está en blanco (usar undefined si no hay default)`;
  }
  if (hasSql && hasModelDefaultValue(col)) {
    return `${name}: declara defaultSql y defaultValue a la vez (son excluyentes; defaultSql tendría precedencia y defaultValue se descartaría)`;
  }
  if (!hasModelDefaultValue(col)) return null;

  const type = (col.columnType ?? "").toLowerCase();
  const v = col.defaultValue as string | number | boolean;

  if (type === "number") {
    const ok = typeof v === "number" ? Number.isFinite(v) : (typeof v === "string" && v.trim().length > 0 && Number.isFinite(Number(v)));
    return ok ? null : `${name}: defaultValue ${JSON.stringify(v)} no es numérico y la columna es number`;
  }
  if (type === "boolean") {
    const ok = typeof v === "boolean" || (typeof v === "string" && ["true", "false"].includes(v.toLowerCase()));
    return ok ? null : `${name}: defaultValue ${JSON.stringify(v)} no es booleano y la columna es boolean`;
  }
  if (type === "jsonb") {
    if (typeof v !== "string") return `${name}: defaultValue de una columna jsonb debe ser un string con JSON válido`;
    try {
      JSON.parse(v);
    } catch {
      return `${name}: defaultValue no es JSON válido y la columna es jsonb`;
    }
    return null;
  }
  // columnas respaldadas por varchar(N): string, Date, picker, color, file/image
  const maxLength = parsePostgresType(columnPostgresType(col)).length;
  if (maxLength !== undefined && typeof v === "string" && v.length > maxLength) {
    return `${name}: defaultValue de largo ${v.length} excede el varchar(${maxLength}) de la columna`;
  }
  return null;
}

/**
 * Corre `validateColumnDefault` sobre un modelo completo. Permite al consumidor lintear su metadata
 * al arrancar, sin conexión a BD.
 * @param {IHuemulColumnDef[]} columnsInfo
 * @return {string[]} mensajes de los defaults inválidos (vacío si todos son válidos)
 */
export function validateColumnDefaults(columnsInfo: IHuemulColumnDef[]): string[] {
  return columnsInfo.map(validateColumnDefault).filter((e): e is string => e !== null);
}

/**
 * Forma que debe tener un tipo PostgreSQL para ser interpolado en el DDL: nombre (con calificador de
 * esquema opcional), argumentos numéricos opcionales `(n)` / `(n,m)` y sufijo de array opcional `[]`.
 * Deja fuera `;`, comillas, `--` y paréntesis con contenido no numérico, que es por donde entraría
 * una inyección vía `columnType` — `dataTypeToPostgres` devuelve crudo todo tipo que no reconoce.
 */
const SAFE_TYPE_PATTERN = /^(?:[A-Za-z_][A-Za-z0-9_]*\.)?[A-Za-z][A-Za-z0-9_ ]*(?:\(\s*\d+\s*(?:,\s*\d+\s*)?\))?(?:\[\])?$/;

/** Largo máximo de un identificador en PostgreSQL (NAMEDATALEN - 1). Más allá, PG trunca en silencio. */
const MAX_IDENT_BYTES = 63;

/**
 * true si el texto trae algún carácter de control (incluye NUL y DEL). Se comprueba por charCode y no
 * con un rango en regex, para no dejar bytes invisibles en el fuente.
 * @param {string} text
 * @return {boolean}
 */
function hasControlChar(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/**
 * Valida un identificador (tabla o columna) antes de interpolarlo. `quoteIdent` ya escapa, esto
 * reporta la metadata inválida además de detectar el truncado silencioso de PG, que en un diff se
 * manifiesta como una columna que "falta" en cada corrida y nunca termina de crearse.
 * @param {string} name
 * @param {string} what descripción para el mensaje, ej. "columnName"
 * @return {string | null}
 */
export function validateIdentifier(name: string, what: string): string | null {
  const raw = String(name ?? "");
  if (raw.trim().length === 0) return `${what} está vacío`;
  if (raw.includes("\"")) return `${what} ${JSON.stringify(raw)} contiene comillas dobles`;
  // `'` y `;` van escapados igual, pero en metadata de modelo nunca son legítimos: se reportan
  if (/['`;]/.test(raw)) return `${what} ${JSON.stringify(raw)} contiene comillas o punto y coma`;
  // cubre también el NUL que `quoteIdent` elimina
  if (hasControlChar(raw)) return `${what} ${JSON.stringify(raw)} contiene caracteres de control`;
  const bytes = new TextEncoder().encode(raw).length;
  if (bytes > MAX_IDENT_BYTES) return `${what} ${JSON.stringify(raw)} excede los ${MAX_IDENT_BYTES} bytes que admite PostgreSQL (lo truncaría en silencio)`;
  return null;
}

/**
 * Valida que el tipo PostgreSQL derivado de la columna sea interpolable sin riesgo. Como
 * `dataTypeToPostgres` devuelve el `columnType` crudo cuando no lo reconoce, esto es lo que evita que
 * un columnType arbitrario llegue al DDL; de paso caza columnType mal escritos.
 * @param {IHuemulColumnDef} col
 * @return {string | null}
 */
export function validateColumnType(col: IHuemulColumnDef): string | null {
  const type = columnPostgresType(col);
  if (!SAFE_TYPE_PATTERN.test(type)) {
    return `${col.columnName}: el tipo generado ${JSON.stringify(type)} no tiene una forma válida (columnType ${JSON.stringify(col.columnType)})`;
  }
  return null;
}

/**
 * Valida una columna completa: identificador, tipo, default y — si declara FK — los identificadores
 * de la tabla/columna referenciada.
 * @param {IHuemulColumnDef} col
 * @return {string[]} mensajes de los problemas (vacío si la columna es válida)
 */
export function validateColumn(col: IHuemulColumnDef): string[] {
  const errors: string[] = [];
  const identError = validateIdentifier(col.columnName, "columnName");
  if (identError !== null) errors.push(identError);
  const typeError = validateColumnType(col);
  if (typeError !== null) errors.push(typeError);
  const defaultError = validateColumnDefault(col);
  if (defaultError !== null) errors.push(defaultError);
  if ((col.PKModuleName ?? "").length > 0) {
    const fkTable = validateIdentifier(col.PKModuleName ?? "", `${col.columnName}: PKModuleName`);
    if (fkTable !== null) errors.push(fkTable);
    const fkColumn = validateIdentifier(col.PKModuleNameId ?? "", `${col.columnName}: PKModuleNameId`);
    if (fkColumn !== null) errors.push(fkColumn);
  }
  return errors;
}

/**
 * Valida el modelo completo antes de generar cualquier DDL: nombre de tabla + todas las columnas.
 * Pensado también para que el consumidor lintee su metadata al arrancar, sin conexión a BD.
 * @param {IHuemulColumnDef[]} columnsInfo
 * @param {string} tableName
 * @return {string[]} mensajes de los problemas (vacío si el modelo es válido)
 */
export function validateModel(columnsInfo: IHuemulColumnDef[], tableName: string): string[] {
  const errors: string[] = [];
  const tableError = validateIdentifier(tableName, "tableName");
  if (tableError !== null) errors.push(tableError);
  for (const col of columnsInfo) errors.push(...validateColumn(col));
  return errors;
}

/**
 * Fragmento de definición de una columna: "col" tipo [NOT NULL] [DEFAULT ...]. Reutilizado por el
 * CREATE TABLE. Solo emite DEFAULT cuando está declarado en el modelo (`defaultValue` o `defaultSql`);
 * en un CREATE no hay filas, así que no se fuerzan defaults por tipo en columnas NOT NULL.
 * @param {IHuemulColumnDef} col
 * @return {string}
 */
export function buildColumnDefSql(col: IHuemulColumnDef): string {
  const notNull = col.allowNull ? "" : " NOT NULL";
  const def = hasModelDefault(col) ? ` DEFAULT ${sqlDefaultLiteral(col)}` : "";
  return `${quoteIdent(col.columnName)} ${columnPostgresType(col)}${notNull}${def}`;
}

/**
 * CREATE TABLE completo desde el modelo (columnas + PK + FK ON DELETE CASCADE). Usado cuando la tabla no existe.
 * @param {IHuemulColumnDef[]} columnsInfo
 * @param {string} tableName
 * @return {string}
 */
export function buildCreateTableSql(columnsInfo: IHuemulColumnDef[], tableName: string): string {
  const lines: string[] = columnsInfo.map(buildColumnDefSql);

  const pkCols = columnsInfo.filter((c) => isPk(c.pkType)).map((c) => quoteIdent(c.columnName));
  if (pkCols.length > 0) lines.push(`PRIMARY KEY (${pkCols.join(", ")})`);

  for (const c of columnsInfo.filter((e) => (e.PKModuleName ?? "").length > 0)) {
    lines.push(`FOREIGN KEY (${quoteIdent(c.columnName)}) REFERENCES ${quoteIdent(c.PKModuleName ?? "")}(${quoteIdent(c.PKModuleNameId ?? "")}) ON DELETE CASCADE`);
  }

  return `CREATE TABLE ${quoteIdent(tableName)} (\n${lines.join(",\n")}\n);`;
}

/**
 * ALTER TABLE ... ADD COLUMN. Para columnas NOT NULL agrega `NOT NULL DEFAULT <valor>` (el default
 * rellena las filas existentes y se mantiene en la columna); el valor sale del modelo (`defaultValue`
 * literal o `defaultSql` como expresión) o de un fallback por tipo. Para columnas nullable emite
 * `DEFAULT` solo si está declarado en el modelo. No agrega el constraint FK (la reconciliación de FK
 * es responsabilidad de otro mecanismo).
 * @param {string} tableName
 * @param {IHuemulColumnDef} col
 * @return {string}
 */
export function buildAddColumnSql(tableName: string, col: IHuemulColumnDef): string {
  const base = `ALTER TABLE ${quoteIdent(tableName)} ADD COLUMN ${quoteIdent(col.columnName)} ${columnPostgresType(col)}`;
  if (!col.allowNull) {
    return `${base} NOT NULL DEFAULT ${sqlDefaultLiteral(col)}`;
  }
  if (hasModelDefault(col)) {
    return `${base} DEFAULT ${sqlDefaultLiteral(col)}`;
  }
  return base;
}

/**
 * ALTER TABLE ... ALTER COLUMN ... TYPE ... USING cast.
 * @param {string} tableName
 * @param {IHuemulColumnDef} col
 * @return {string}
 */
export function buildAlterColumnTypeSql(tableName: string, col: IHuemulColumnDef): string {
  const type = columnPostgresType(col);
  const ident = quoteIdent(col.columnName);
  return `ALTER TABLE ${quoteIdent(tableName)} ALTER COLUMN ${ident} TYPE ${type} USING ${ident}::${type}`;
}

/**
 * Compara el modelo (columnsInfo) contra las columnas reales y devuelve el diff (sin ejecutar nada).
 * @param {IHuemulColumnDef[]} columnsInfo
 * @param {ISchemaColumn[]} actualRows
 * @param {string} tableName
 * @return {ITableSchemaDiff}
 */
export function diffTableColumns(columnsInfo: IHuemulColumnDef[], actualRows: ISchemaColumn[], tableName: string): ITableSchemaDiff {
  const tableMissing = actualRows.length === 0;
  if (tableMissing) {
    return {tableName, tableMissing: true, toAdd: [], toAlter: [], extra: []};
  }

  const actualMap = new Map<string, ISchemaColumn>();
  for (const r of actualRows) actualMap.set(r.columnName, r);

  const toAdd: IHuemulColumnDef[] = [];
  const toAlter: IColumnDiff[] = [];
  const modelNames = new Set<string>();

  for (const col of columnsInfo) {
    modelNames.add(col.columnName);
    const actual = actualMap.get(col.columnName);
    if (actual === undefined) {
      toAdd.push(col);
      continue;
    }
    const expected = canonicalFromColumnDef(col);
    const real = canonicalFromInformationSchema(actual);
    if (!typesMatch(expected, real)) {
      toAlter.push({
        columnName: col.columnName,
        kind: "alter",
        expectedType: columnPostgresType(col),
        actualType: describeActual(actual),
        allowNull: col.allowNull,
      });
    }
  }

  const extra = actualRows.filter((r) => !modelNames.has(r.columnName)).map((r) => r.columnName);

  return {tableName, tableMissing: false, toAdd, toAlter, extra};
}

/**
 * Sincroniza una tabla: introspección + diff + generación (y opcionalmente ejecución) de CREATE/ALTER.
 * No lanza: los errores se acumulan en el resultado.
 * @param {SqlRunner} run
 * @param {IHuemulColumnDef[]} columnsInfo
 * @param {string} tableName
 * @param {ISchemaSyncOptions} opts
 * @return {Promise<ITableSyncResult>}
 */
export async function syncTableSchema(run: SqlRunner, columnsInfo: IHuemulColumnDef[], tableName: string, opts?: ISchemaSyncOptions): Promise<ITableSyncResult> {
  const applyChanges = opts?.applyChanges ?? false;
  const applyTypeChanges = opts?.applyTypeChanges ?? true;

  const result: ITableSyncResult = {tableName, tableMissing: false, added: [], typeChanged: [], extra: [], errors: [], sql: []};

  // el tableName se valida antes de la introspección, que es la primera sentencia que lo interpola
  const tableError = validateIdentifier(tableName, "tableName");
  if (tableError !== null) {
    result.errors.push(`introspect ${tableName}: ${tableError}`);
    return result;
  }

  let actualRows: ISchemaColumn[];
  try {
    const rows = await run(informationSchemaColumnsSql(tableName));
    actualRows = rows.map(toSchemaColumn);
  } catch (error) {
    result.errors.push(`introspect ${tableName}: ${String(error)}`);
    return result;
  }

  const diff = diffTableColumns(columnsInfo, actualRows, tableName);
  result.tableMissing = diff.tableMissing;
  result.extra = diff.extra;

  if (diff.tableMissing) {
    // metadata inválida haría fallar el CREATE completo: se reporta y no se ofrece la sentencia
    const modelErrors = validateModel(columnsInfo, tableName);
    if (modelErrors.length > 0) {
      for (const message of modelErrors) result.errors.push(`create ${tableName}: ${message}`);
      return result;
    }
    const sql = buildCreateTableSql(columnsInfo, tableName);
    result.sql.push(sql);
    if (applyChanges) {
      try {
        await run(sql);
        result.added.push("(table created)");
      } catch (error) {
        result.errors.push(`create ${tableName}: ${String(error)}`);
      }
    } else {
      result.added.push("(table would be created)");
    }
    return result;
  }

  for (const col of diff.toAdd) {
    // sentencias independientes: la columna con metadata inválida se salta, las demás siguen
    const colErrors = validateColumn(col);
    if (colErrors.length > 0) {
      for (const message of colErrors) result.errors.push(`add ${tableName}.${col.columnName}: ${message}`);
      continue;
    }
    const sql = buildAddColumnSql(tableName, col);
    result.sql.push(sql);
    if (applyChanges) {
      try {
        await run(sql);
        result.added.push(col.columnName);
      } catch (error) {
        result.errors.push(`add ${tableName}.${col.columnName}: ${String(error)}`);
      }
    } else {
      result.added.push(col.columnName);
    }
  }

  for (const change of diff.toAlter) {
    if (!applyTypeChanges) {
      result.typeChanged.push(`${change.columnName} (${change.actualType} -> ${change.expectedType}) [skipped: applyTypeChanges=false]`);
      continue;
    }
    const col = columnsInfo.find((c) => c.columnName === change.columnName);
    if (col === undefined) continue;
    // el ALTER interpola el tipo dos veces (TYPE y el cast del USING): se valida antes de generarlo
    const identError = validateIdentifier(col.columnName, "columnName");
    const typeError = validateColumnType(col);
    if (identError !== null || typeError !== null) {
      for (const message of [identError, typeError].filter((e): e is string => e !== null)) {
        result.errors.push(`alter ${tableName}.${change.columnName}: ${message}`);
      }
      continue;
    }
    const sql = buildAlterColumnTypeSql(tableName, col);
    result.sql.push(sql);
    if (applyChanges) {
      try {
        await run(sql);
        result.typeChanged.push(`${change.columnName} (${change.actualType} -> ${change.expectedType})`);
      } catch (error) {
        result.errors.push(`alter ${tableName}.${change.columnName} (${change.actualType} -> ${change.expectedType}): ${String(error)}`);
      }
    } else {
      result.typeChanged.push(`${change.columnName} (${change.actualType} -> ${change.expectedType})`);
    }
  }

  return result;
}

/**
 * Sincroniza varios módulos/tablas en secuencia. El consumidor decide el orden (p.ej. ordenar por FK).
 * @param {SqlRunner} run
 * @param {ISyncModule[]} modules
 * @param {ISchemaSyncOptions} opts
 * @return {Promise<ITableSyncResult[]>}
 */
export async function syncSchema(run: SqlRunner, modules: ISyncModule[], opts?: ISchemaSyncOptions): Promise<ITableSyncResult[]> {
  const results: ITableSyncResult[] = [];
  for (const mod of modules) {
    results.push(await syncTableSchema(run, mod.columnsInfo, mod.tableName, opts));
  }
  return results;
}
