/* eslint max-len: ["error", { "code": 400 }] */
//version 1.0.0 2026-08-16 SRODRIGUEZ - contrato de módulos y orquestador updateModules (tablas, columnas e índices)
import {IHuemulColumnDef} from "../interfaces/interface-huemul-column-def";
import {HuemulLog, IHuemulWhoIAm} from "../logging/huemul-log";
import {isNotEmpty} from "../functions/huemul-functions";
import {
  ISchemaSyncOptions,
  ITableSyncResult,
  SqlRunner,
  quoteIdent,
  syncTableSchema,
  validateIdentifier,
} from "../gen-postgres-schema";

/**
 * Índice declarativo de una tabla. Se emite como CREATE INDEX IF NOT EXISTS, de modo que declararlo
 * sobre una base que ya lo tiene es un no-op y la función se puede llamar tantas veces como se
 * quiera.
 */
export interface IHuemulIndexDef {
  /** nombre del índice; debe ser único en el esquema */
  indexName: string,
  /** columnas en el orden que define el índice */
  columns: string[],
  unique?: boolean,
}

/**
 * Entrada del registro de módulos: la tabla de un módulo, dónde vive y sus índices.
 * Cada package que posee tablas exporta un arreglo de estas entradas y una función que las
 * sincroniza; las aplicaciones dejan de declarar las tablas de sus dependencias.
 * TModuleId permite tipar el moduleId con el enum propio de cada aplicación.
 */
export interface IHuemulModuleDef<TModuleId extends string = string> {
  moduleId: TModuleId,
  columnsInfo: IHuemulColumnDef[],
  tableName: string,
  /**
   * base de datos destino. Default (undefined) = 'orgDb': la base de cada organización.
   * 'adminDb': la base central/admin. Filtrar con `(e.createIn ?? 'orgDb')` para respetar el default.
   */
  createIn?: 'adminDb' | 'orgDb',
  /**
   * Hook de instalación RBAC (inserta el módulo y sus permisos). `updateModules` NO lo ejecuta:
   * el registro RBAC corre una vez por ambiente contra la base central, mientras el DDL corre por
   * organización. Mezclarlos rompería ese orden.
   */
  installModule?: (whoIAm: IHuemulWhoIAm, forceCreate: boolean) => Promise<HuemulLog<any>>,
  indexes?: IHuemulIndexDef[],
}

/** Resultado de aplicar un índice declarado. */
export interface IIndexSyncResult {
  tableName: string,
  indexName: string,
  /** true si la sentencia se ejecutó; false en modo evaluación (applyChanges: false) */
  applied: boolean,
}

/** Resultado agregado de updateModules. */
export interface IUpdateModulesResult {
  /** un resultado por módulo, en el orden en que se sincronizaron (orden de FK) */
  modules: ITableSyncResult[],
  indexes: IIndexSyncResult[],
  /** todas las sentencias generadas, tablas e índices */
  sql: string[],
  /** errores acumulados de todos los módulos; updateModules no lanza */
  errors: string[],
}

/**
 * Opciones de updateModules. Son las de ISchemaSyncOptions, pero applyChanges tiene el default
 * INVERTIDO: updateModules es la función "ejecutar la actualización", así que por defecto aplica y
 * el dry-run es el opt-in (applyChanges: false). syncTableSchema/syncSchema conservan su default
 * seguro (false).
 * applyNarrowingChanges mantiene el default false en ambas: ninguna reducción de capacidad se
 * aplica sin pedirlo explícitamente.
 */
export interface IUpdateModulesOptions extends ISchemaSyncOptions {
}

/**
 * Ordena los módulos por dependencias de FK.
 *
 * Devuelve un arreglo nuevo donde toda tabla referenciada vía el `PKModuleName` de una columna
 * aparece antes de la que la referencia (orden seguro para CREATE TABLE con FOREIGN KEY inline).
 * Las auto-referencias se ignoran (un auto-FK inline es válido en PostgreSQL) y las referencias a
 * tablas fuera de la lista también (se asumen ya existentes, p.ej. las tablas de auth). El orden es
 * estable: entre módulos cuyas dependencias ya están satisfechas se conserva el orden original.
 *
 * @author Sebastián Rodríguez Robotham
 * @param {IHuemulModuleDef[]} modules registro de módulos (no se muta)
 * @return {IHuemulModuleDef[]} arreglo nuevo en orden seguro de creación
 * @throws {Error} si la metadata de FK tiene un ciclo; el mensaje lista los módulos involucrados y
 * sus dependencias pendientes. Se corrige quitando un FK de la metadata (PKModuleName = '') y, si
 * la restricción se sigue queriendo, creándola después con ALTER TABLE ADD CONSTRAINT.
 */
export function sortModulesByFkDependencies<TModuleId extends string = string>(
    modules: IHuemulModuleDef<TModuleId>[],
): IHuemulModuleDef<TModuleId>[] {
  // se indexa por tableName: PKModuleName guarda el nombre de la tabla referenciada, tal como se usa en REFERENCES "..."
  const byTableName = new Map<string, IHuemulModuleDef<TModuleId>>();
  for (const mod of modules) {
    byTableName.set(mod.tableName, mod);
  }

  // dependencias por módulo: tableNames referenciados, sin auto-referencias ni tablas desconocidas
  const pendingDeps = new Map<IHuemulModuleDef<TModuleId>, Set<string>>();
  for (const mod of modules) {
    const deps = new Set<string>();
    for (const col of mod.columnsInfo) {
      if (isNotEmpty(col.PKModuleName) && col.PKModuleName !== mod.tableName && byTableName.has(col.PKModuleName as string)) {
        deps.add(col.PKModuleName as string);
      }
    }
    pendingDeps.set(mod, deps);
  }

  // algoritmo de Kahn, estable: en cada pasada se toman, en el orden original, los módulos con dependencias resueltas
  const sorted: IHuemulModuleDef<TModuleId>[] = [];
  const done = new Set<string>();
  let remaining = modules.slice();

  while (remaining.length > 0) {
    const ready = remaining.filter((mod) => Array.from(pendingDeps.get(mod) ?? []).every((dep) => done.has(dep)));

    if (ready.length === 0) {
      const cycleDetail = remaining
          .map((mod) => `${mod.tableName} -> [${Array.from(pendingDeps.get(mod) ?? []).filter((dep) => !done.has(dep)).join(", ")}]`)
          .join("; ");
      throw new Error(`sortModulesByFkDependencies: FK cycle detected between modules: ${cycleDetail}. ` +
        `Remove one FK from the column metadata (set PKModuleName to '') and, if needed, create that constraint later with ALTER TABLE ADD CONSTRAINT.`);
    }

    for (const mod of ready) {
      sorted.push(mod);
      done.add(mod.tableName);
    }
    remaining = remaining.filter((mod) => !done.has(mod.tableName));
  }

  return sorted;
}

/**
 * Valida la metadata de un índice antes de interpolarla en el DDL. Mismo criterio que
 * validateColumn: el nombre del índice y cada columna son identificadores.
 * @param {string} tableName tabla del índice
 * @param {IHuemulIndexDef} index índice declarado
 * @return {string[]} mensajes de los problemas (vacío si es válido)
 */
export function validateIndex(tableName: string, index: IHuemulIndexDef): string[] {
  const errors: string[] = [];

  const tableError = validateIdentifier(tableName, "tableName");
  if (tableError !== null) errors.push(tableError);

  const nameError = validateIdentifier(index.indexName ?? "", "indexName");
  if (nameError !== null) errors.push(nameError);

  if ((index.columns ?? []).length === 0) {
    errors.push(`${index.indexName}: el índice no declara columnas`);
  }
  for (const column of index.columns ?? []) {
    const columnError = validateIdentifier(column, `${index.indexName}: columnName`);
    if (columnError !== null) errors.push(columnError);
  }

  return errors;
}

/**
 * Genera el CREATE INDEX de un índice declarado. Siempre IF NOT EXISTS: declarar un índice que ya
 * existe debe ser un no-op para que updateModules se pueda llamar tantas veces como se quiera.
 * @param {string} tableName tabla del índice
 * @param {IHuemulIndexDef} index índice declarado
 * @return {string}
 */
export function buildCreateIndexSql(tableName: string, index: IHuemulIndexDef): string {
  const unique = index.unique === true ? "UNIQUE " : "";
  const columns = (index.columns ?? []).map((c) => quoteIdent(c)).join(", ");

  return `CREATE ${unique}INDEX IF NOT EXISTS ${quoteIdent(index.indexName)} ON ${quoteIdent(tableName)} (${columns})`;
}

/**
 * Crea/actualiza las tablas, columnas e índices de un conjunto de módulos.
 *
 * Es la función que cada package expone (vía su propio wrapper, que además resuelve la conexión)
 * para que las aplicaciones no tengan que declarar las tablas de sus dependencias. Ordena por FK,
 * sincroniza cada tabla con syncTableSchema y después crea los índices declarados.
 *
 * No lanza: los errores se acumulan en el resultado, igual que syncTableSchema. La única excepción
 * es un ciclo de FK, que sortModulesByFkDependencies reporta como error de metadata y aquí se
 * captura hacia errors[].
 *
 * @author Sebastián Rodríguez Robotham
 * @param {SqlRunner} run ejecutor de SQL contra la base destino
 * @param {IHuemulModuleDef[]} modules módulos a sincronizar (todos van a la MISMA base: filtrar por createIn antes de llamar)
 * @param {IUpdateModulesOptions} opts applyChanges default true; applyNarrowingChanges default false
 * @return {Promise<IUpdateModulesResult>}
 */
export async function updateModules(run: SqlRunner, modules: IHuemulModuleDef[], opts?: IUpdateModulesOptions): Promise<IUpdateModulesResult> {
  // default invertido respecto de syncTableSchema: esta es la función "ejecutar", el dry-run es el opt-in
  const applyChanges = opts?.applyChanges ?? true;
  const syncOptions: ISchemaSyncOptions = {
    applyChanges,
    applyTypeChanges: opts?.applyTypeChanges,
    applyNarrowingChanges: opts?.applyNarrowingChanges,
  };

  const result: IUpdateModulesResult = {modules: [], indexes: [], sql: [], errors: []};

  let ordered: IHuemulModuleDef[];
  try {
    ordered = sortModulesByFkDependencies(modules);
  } catch (error) {
    // un ciclo de FK es metadata inválida: no se sincroniza nada, porque el orden no está definido
    result.errors.push(String(error));
    return result;
  }

  for (const mod of ordered) {
    const tableResult = await syncTableSchema(run, mod.columnsInfo, mod.tableName, syncOptions);
    result.modules.push(tableResult);
    result.sql.push(...tableResult.sql);
    result.errors.push(...tableResult.errors);

    // los índices van DESPUÉS de la tabla: si la tabla acaba de fallar, el CREATE INDEX fallaría igual
    if (tableResult.errors.length > 0) continue;

    for (const index of mod.indexes ?? []) {
      const indexErrors = validateIndex(mod.tableName, index);
      if (indexErrors.length > 0) {
        for (const message of indexErrors) result.errors.push(`index ${mod.tableName}.${index.indexName}: ${message}`);
        continue;
      }

      const sql = buildCreateIndexSql(mod.tableName, index);
      result.sql.push(sql);

      if (!applyChanges) {
        result.indexes.push({tableName: mod.tableName, indexName: index.indexName, applied: false});
        continue;
      }

      try {
        await run(sql);
        result.indexes.push({tableName: mod.tableName, indexName: index.indexName, applied: true});
      } catch (error) {
        result.errors.push(`index ${mod.tableName}.${index.indexName}: ${String(error)}`);
      }
    }
  }

  return result;
}
