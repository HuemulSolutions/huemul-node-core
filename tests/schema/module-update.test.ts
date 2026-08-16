import { describe, it, expect } from 'vitest'
import {
  sortModulesByFkDependencies,
  buildCreateIndexSql,
  validateIndex,
  updateModules,
} from '../../src/schema/huemul-module-update'
import type { IHuemulModuleDef } from '../../src/schema/huemul-module-update'
import type { SqlRunner } from '../../src/gen-postgres-schema'
import type { IHuemulColumnDef } from '../../src/interfaces/interface-huemul-column-def'

// helper: columna con defaults razonables
function col(partial: Partial<IHuemulColumnDef> & { columnName: string; columnType: string }): IHuemulColumnDef {
  return {
    columnDescription: '',
    pkType: 'none',
    allowNull: true,
    required: false,
    numOrderInGet: 0,
    columnPosition: 0,
    ...partial,
  } as IHuemulColumnDef
}

// helper: módulo cuya única columna referencia a refTable (o sin FK si refTable es undefined)
function mod(tableName: string, refTable?: string, extra?: Partial<IHuemulModuleDef>): IHuemulModuleDef {
  const columnsInfo: IHuemulColumnDef[] = [
    col({ columnName: `${tableName}Id`, columnType: 'string', columnLength: 50, pkType: 'manualPK', allowNull: false }),
  ]
  if (refTable !== undefined) {
    columnsInfo.push(col({
      columnName: `${refTable}Id`,
      columnType: 'string',
      columnLength: 50,
      PKModuleName: refTable,
      PKModuleNameId: `${refTable}Id`,
    }))
  }
  return { moduleId: tableName, tableName, columnsInfo, ...extra }
}

/** runner falso: registra el SQL y responde la introspección con las filas dadas por tabla */
function fakeRunner(existing: Record<string, any[]> = {}) {
  const executed: string[] = []
  const run: SqlRunner = async (sql) => {
    executed.push(sql)
    if (sql.includes('information_schema')) {
      const match = /table_name = '([^']*)'/.exec(sql)
      return existing[match?.[1] ?? ''] ?? []
    }
    return []
  }
  return { run, executed }
}

describe('sortModulesByFkDependencies', () => {
  it('ordena sin lanzar y devuelve todos los módulos, sin duplicados', () => {
    const modules = [mod('child', 'parent'), mod('parent'), mod('lonely')]
    const sorted = sortModulesByFkDependencies(modules)
    expect(sorted).toHaveLength(3)
    expect(new Set(sorted.map((m) => m.tableName)).size).toBe(3)
  })

  it('pone la tabla referenciada antes que la que la referencia', () => {
    const sorted = sortModulesByFkDependencies([mod('orgSet', 'hsConn'), mod('hsConn')])
    const names = sorted.map((m) => m.tableName)
    expect(names.indexOf('hsConn')).toBeLessThan(names.indexOf('orgSet'))
  })

  it('resuelve cadenas de varios niveles', () => {
    const sorted = sortModulesByFkDependencies([mod('c', 'b'), mod('a'), mod('b', 'a')])
    expect(sorted.map((m) => m.tableName)).toEqual(['a', 'b', 'c'])
  })

  it('ignora auto-referencias: un FK inline hacia sí misma es válido en PostgreSQL', () => {
    const selfRef = mod('department', 'department')
    expect(() => sortModulesByFkDependencies([selfRef])).not.toThrow()
    expect(sortModulesByFkDependencies([selfRef])).toHaveLength(1)
  })

  it('ignora referencias a tablas fuera de la lista: se asumen ya existentes', () => {
    const sorted = sortModulesByFkDependencies([mod('department', 'orgs')])
    expect(sorted.map((m) => m.tableName)).toEqual(['department'])
  })

  it('es estable: conserva el orden original entre módulos sin dependencias', () => {
    const sorted = sortModulesByFkDependencies([mod('z'), mod('y'), mod('x')])
    expect(sorted.map((m) => m.tableName)).toEqual(['z', 'y', 'x'])
  })

  it('no muta el arreglo de entrada', () => {
    const modules = [mod('child', 'parent'), mod('parent')]
    const original = modules.map((m) => m.tableName)
    sortModulesByFkDependencies(modules)
    expect(modules.map((m) => m.tableName)).toEqual(original)
  })

  it('lanza un error descriptivo ante un ciclo de FKs', () => {
    expect(() => sortModulesByFkDependencies([mod('tableA', 'tableB'), mod('tableB', 'tableA')]))
        .toThrow(/FK cycle detected.*tableA.*tableB/)
  })
})

describe('buildCreateIndexSql', () => {
  it('genera un índice simple con IF NOT EXISTS', () => {
    const sql = buildCreateIndexSql('internalTasks', { indexName: 'idx_status', columns: ['internalTaskStatus'] })
    expect(sql).toBe('CREATE INDEX IF NOT EXISTS "idx_status" ON "internalTasks" ("internalTaskStatus")')
  })

  it('genera un índice compuesto respetando el orden de las columnas', () => {
    const sql = buildCreateIndexSql('internalTasks', { indexName: 'idx_multi', columns: ['a', 'b', 'c'] })
    expect(sql).toBe('CREATE INDEX IF NOT EXISTS "idx_multi" ON "internalTasks" ("a", "b", "c")')
  })

  it('genera un índice único', () => {
    const sql = buildCreateIndexSql('orgs', { indexName: 'idx_uniq', columns: ['orgId'], unique: true })
    expect(sql).toBe('CREATE UNIQUE INDEX IF NOT EXISTS "idx_uniq" ON "orgs" ("orgId")')
  })
})

describe('validateIndex', () => {
  it('acepta un índice bien formado', () => {
    expect(validateIndex('orgs', { indexName: 'idx_ok', columns: ['orgId'] })).toEqual([])
  })
  it('rechaza un índice sin columnas', () => {
    expect(validateIndex('orgs', { indexName: 'idx_vacio', columns: [] })).toHaveLength(1)
  })
  it('rechaza un indexName con caracteres peligrosos', () => {
    expect(validateIndex('orgs', { indexName: 'x"; DROP TABLE orgs; --', columns: ['orgId'] }).length).toBeGreaterThan(0)
  })
  it('rechaza una columna con caracteres peligrosos', () => {
    expect(validateIndex('orgs', { indexName: 'idx_ok', columns: ['a"; DROP TABLE orgs; --'] }).length).toBeGreaterThan(0)
  })
})

describe('updateModules', () => {
  it('aplica los cambios por defecto: applyChanges es true, al revés que syncTableSchema', async () => {
    const { run, executed } = fakeRunner()
    const result = await updateModules(run, [mod('orgs')])
    expect(executed.some((s) => s.startsWith('CREATE TABLE'))).toBe(true)
    expect(result.modules[0].tableMissing).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('applyChanges=false no ejecuta nada pero sí reporta el SQL', async () => {
    const { run, executed } = fakeRunner()
    const result = await updateModules(run, [mod('orgs')], { applyChanges: false })
    expect(executed.some((s) => s.startsWith('CREATE TABLE'))).toBe(false)
    expect(result.sql.some((s) => s.startsWith('CREATE TABLE'))).toBe(true)
  })

  it('crea las tablas en orden de FK', async () => {
    const { run, executed } = fakeRunner()
    await updateModules(run, [mod('orgSet', 'hsConn'), mod('hsConn')])
    const creates = executed.filter((s) => s.startsWith('CREATE TABLE'))
    expect(creates[0]).toContain('"hsConn"')
    expect(creates[1]).toContain('"orgSet"')
  })

  it('crea los índices DESPUÉS de la tabla', async () => {
    const { run, executed } = fakeRunner()
    const withIndex = mod('internalTasks', undefined, {
      indexes: [{ indexName: 'idx_status', columns: ['internalTasksId'] }],
    })
    const result = await updateModules(run, [withIndex])
    const createTableAt = executed.findIndex((s) => s.startsWith('CREATE TABLE'))
    const createIndexAt = executed.findIndex((s) => s.startsWith('CREATE INDEX'))
    expect(createTableAt).toBeGreaterThanOrEqual(0)
    expect(createIndexAt).toBeGreaterThan(createTableAt)
    expect(result.indexes).toEqual([{ tableName: 'internalTasks', indexName: 'idx_status', applied: true }])
  })

  it('no marca el índice como aplicado en modo evaluación', async () => {
    const { run } = fakeRunner()
    const withIndex = mod('internalTasks', undefined, { indexes: [{ indexName: 'idx_status', columns: ['internalTasksId'] }] })
    const result = await updateModules(run, [withIndex], { applyChanges: false })
    expect(result.indexes[0].applied).toBe(false)
    expect(result.sql.some((s) => s.startsWith('CREATE INDEX'))).toBe(true)
  })

  it('reporta el índice inválido como error y no lo interpola', async () => {
    const { run, executed } = fakeRunner()
    const bad = mod('orgs', undefined, { indexes: [{ indexName: 'x"; DROP TABLE orgs; --', columns: ['orgsId'] }] })
    const result = await updateModules(run, [bad])
    expect(result.errors.length).toBeGreaterThan(0)
    expect(executed.some((s) => s.includes('DROP TABLE'))).toBe(false)
  })

  it('omite los índices de una tabla que falló, pero sigue con los demás módulos', async () => {
    const executed: string[] = []
    const run: SqlRunner = async (sql) => {
      executed.push(sql)
      if (sql.includes('information_schema')) return []
      if (sql.startsWith('CREATE TABLE') && sql.includes('"rota"')) throw new Error('boom')
      return []
    }
    const broken = mod('rota', undefined, { indexes: [{ indexName: 'idx_rota', columns: ['rotaId'] }] })
    const result = await updateModules(run, [broken, mod('sana')])
    expect(result.errors.length).toBeGreaterThan(0)
    expect(executed.some((s) => s.includes('idx_rota'))).toBe(false)
    expect(executed.some((s) => s.startsWith('CREATE TABLE') && s.includes('"sana"'))).toBe(true)
  })

  it('una reducción de capacidad va a narrowing y no se aplica', async () => {
    const existing = {
      orgs: [{ columnName: 'orgsId', dataType: 'text', characterMaximumLength: null, numericPrecision: null, numericScale: null, isNullable: 'NO' }],
    }
    const { run, executed } = fakeRunner(existing)
    const result = await updateModules(run, [mod('orgs')])
    expect(result.modules[0].narrowing).toHaveLength(1)
    expect(result.modules[0].typeChanged).toHaveLength(0)
    expect(executed.some((s) => s.includes('ALTER COLUMN'))).toBe(false)
  })

  it('un ciclo de FK no sincroniza nada y se reporta como error, sin lanzar', async () => {
    const { run, executed } = fakeRunner()
    const result = await updateModules(run, [mod('tableA', 'tableB'), mod('tableB', 'tableA')])
    expect(result.errors[0]).toMatch(/FK cycle detected/)
    expect(result.modules).toHaveLength(0)
    expect(executed).toHaveLength(0)
  })

  it('segunda corrida sobre un esquema ya alineado: no genera CREATE TABLE', async () => {
    const first = fakeRunner()
    await updateModules(first.run, [mod('orgs')])

    // el esquema ya existe con la forma del modelo
    const existing = {
      orgs: [{ columnName: 'orgsId', dataType: 'character varying', characterMaximumLength: 50, numericPrecision: null, numericScale: null, isNullable: 'NO' }],
    }
    const second = fakeRunner(existing)
    const result = await updateModules(second.run, [mod('orgs')])
    expect(second.executed.some((s) => s.startsWith('CREATE TABLE'))).toBe(false)
    expect(result.modules[0].added).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })
})
