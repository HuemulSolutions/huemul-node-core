import { describe, it, expect } from 'vitest'
import {
  FK_ON_DELETE_ACTIONS,
  buildAddForeignKeySql,
  buildCreateTableSql,
  buildDropConstraintSql,
  fkConstraintName,
  fkOnDeleteAction,
  informationSchemaForeignKeysSql,
  modelForeignKeys,
  syncTableSchema,
  validateColumn,
  validateColumnFk,
} from '../../src/gen-postgres-schema'
import type { SqlRunner } from '../../src/gen-postgres-schema'
import type { IHuemulColumnDef } from '../../src/interfaces/interface-huemul-column-def'

function col(partial: Partial<IHuemulColumnDef> & { columnName: string; columnType: string }): IHuemulColumnDef {
  return {
    columnDescription: '',
    pkType: 'none',
    allowNull: true,
    required: false,
    numOrderInGet: 0,
    columnPosition: 0,
    ...partial,
  }
}

/**
 * Acción de borrado de las FK.
 *
 * Antes, todas las FK que generaba el modelo eran ON DELETE CASCADE sin forma de pedir otra cosa, así
 * que cada aplicación que necesitaba SET NULL terminaba escribiendo un ALTER a mano después del sync.
 */
describe('fkOnDelete: acción declarada por columna', () => {
  it('sin declarar nada, sigue siendo CASCADE (comportamiento histórico)', () => {
    expect(fkOnDeleteAction(col({ columnName: 'custId', columnType: 'string', PKModuleName: 'customer', PKModuleNameId: 'custId' }))).toBe('CASCADE')
  })

  it('respeta la acción declarada', () => {
    for (const accion of FK_ON_DELETE_ACTIONS) {
      expect(fkOnDeleteAction(col({ columnName: 'custId', columnType: 'string', fkOnDelete: accion }))).toBe(accion)
    }
  })

  it('el CREATE TABLE emite la acción de cada columna', () => {
    const sql = buildCreateTableSql([
      col({ columnName: 'subsId', columnType: 'string', columnLength: 50, pkType: 'manualPK', allowNull: false }),
      col({ columnName: 'custId', columnType: 'string', columnLength: 50, PKModuleName: 'customer', PKModuleNameId: 'custId' }),
      col({ columnName: 'planId', columnType: 'string', columnLength: 50, PKModuleName: 'plan', PKModuleNameId: 'planId', fkOnDelete: 'SET NULL' }),
    ], 'subscription')

    expect(sql).toContain('FOREIGN KEY ("custId") REFERENCES "customer"("custId") ON DELETE CASCADE')
    expect(sql).toContain('FOREIGN KEY ("planId") REFERENCES "plan"("planId") ON DELETE SET NULL')
  })

  it('SET NULL sobre una columna NOT NULL se rechaza', () => {
    // PostgreSQL lo acepta al declarar y falla recién al borrar la fila referenciada, con la tabla
    // ya en producción. Se caza al validar el modelo.
    const errores = validateColumnFk(col({ columnName: 'planId', columnType: 'string', allowNull: false, PKModuleName: 'plan', PKModuleNameId: 'planId', fkOnDelete: 'SET NULL' }))
    expect(errores.join(' ')).toContain('allowNull: true')
  })

  it('SET NULL sobre una columna nullable es válido', () => {
    expect(validateColumnFk(col({ columnName: 'planId', columnType: 'string', allowNull: true, fkOnDelete: 'SET NULL' }))).toEqual([])
  })

  it('una acción inexistente se rechaza en vez de llegar al DDL', () => {
    const errores = validateColumnFk(col({ columnName: 'planId', columnType: 'string', fkOnDelete: 'DROP TABLE' as never }))
    expect(errores.join(' ')).toContain('no es una accion valida')
  })

  it('declarar fkOnDelete sin ser FK se reporta: es una expectativa que nunca se cumpliría', () => {
    const errores = validateColumn(col({ columnName: 'planId', columnType: 'string', columnLength: 50, fkOnDelete: 'SET NULL' }))
    expect(errores.join(' ')).toContain('no es FK')
  })
})

describe('modelForeignKeys y sus sentencias', () => {
  const modelo = [
    col({ columnName: 'subsId', columnType: 'string', columnLength: 50, pkType: 'manualPK', allowNull: false }),
    col({ columnName: 'custId', columnType: 'string', columnLength: 50, PKModuleName: 'customer', PKModuleNameId: 'custId' }),
    col({ columnName: 'planId', columnType: 'string', columnLength: 50, PKModuleName: 'plan', PKModuleNameId: 'planId', fkOnDelete: 'SET NULL' }),
  ]

  it('lista solo las columnas que declaran FK', () => {
    expect(modelForeignKeys(modelo, 'subscription').map((f) => f.columnName)).toEqual(['custId', 'planId'])
  })

  it('el nombre del constraint es el que autogenera PostgreSQL', () => {
    // Usar el mismo nombre es lo que permite reconocer las FK ya creadas en vez de duplicarlas.
    expect(fkConstraintName('subscription', 'custId')).toBe('subscription_custId_fkey')
  })

  it('genera el ADD CONSTRAINT con su acción', () => {
    const fk = modelForeignKeys(modelo, 'subscription')[1]
    expect(buildAddForeignKeySql('subscription', fk))
      .toBe('ALTER TABLE "subscription" ADD CONSTRAINT "subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plan"("planId") ON DELETE SET NULL;')
  })

  it('el DROP es tolerante a que no exista', () => {
    expect(buildDropConstraintSql('subscription', 'subscription_planId_fkey'))
      .toBe('ALTER TABLE "subscription" DROP CONSTRAINT IF EXISTS "subscription_planId_fkey";')
  })

  it('la consulta de introspección pide la acción de borrado real', () => {
    const sql = informationSchemaForeignKeysSql('subscription')
    expect(sql).toContain('delete_rule')
    expect(sql).toContain("tc.table_name = 'subscription'")
  })
})

describe('reconciliación de FK en tablas existentes', () => {
  const modelo = [
    col({ columnName: 'subsId', columnType: 'string', columnLength: 50, pkType: 'manualPK', allowNull: false }),
    col({ columnName: 'custId', columnType: 'string', columnLength: 50, PKModuleName: 'customer', PKModuleNameId: 'custId' }),
    col({ columnName: 'planId', columnType: 'string', columnLength: 50, PKModuleName: 'plan', PKModuleNameId: 'planId', fkOnDelete: 'SET NULL' }),
  ]

  const columnasReales = [
    { columnName: 'subsId', dataType: 'character varying', characterMaximumLength: 50, numericPrecision: null, numericScale: null, isNullable: 'NO' },
    { columnName: 'custId', dataType: 'character varying', characterMaximumLength: 50, numericPrecision: null, numericScale: null, isNullable: 'YES' },
    { columnName: 'planId', dataType: 'character varying', characterMaximumLength: 50, numericPrecision: null, numericScale: null, isNullable: 'YES' },
  ]

  const runner = (fkReales: Record<string, unknown>[], ejecutadas: string[]): SqlRunner => async (sql) => {
    ejecutadas.push(sql)
    if (sql.includes('information_schema.table_constraints')) return fkReales
    if (sql.includes('information_schema')) return columnasReales
    return []
  }

  it('sin applyForeignKeys no mira ni toca las FK', async () => {
    const ejecutadas: string[] = []
    const result = await syncTableSchema(runner([], ejecutadas), modelo, 'subscription', { applyChanges: true })

    expect(result.foreignKeys).toEqual([])
    expect(ejecutadas.some((s) => s.includes('table_constraints'))).toBe(false)
    expect(ejecutadas.some((s) => s.includes('ADD CONSTRAINT'))).toBe(false)
  })

  it('crea la FK que falta sobre una columna que ya existía', async () => {
    // Es el caso que obligaba al ALTER manual: buildAddColumnSql nunca agrega el constraint.
    const ejecutadas: string[] = []
    const result = await syncTableSchema(runner([], ejecutadas), modelo, 'subscription', { applyChanges: true, applyForeignKeys: true })

    expect(result.foreignKeys).toEqual(['subscription_custId_fkey (CASCADE)', 'subscription_planId_fkey (SET NULL)'])
    expect(ejecutadas.filter((s) => s.includes('ADD CONSTRAINT'))).toHaveLength(2)
    expect(result.errors).toEqual([])
  })

  it('deja en paz la FK que ya está con la acción correcta', async () => {
    const ejecutadas: string[] = []
    const fkReales = [
      { constraintName: 'subscription_custId_fkey', columnName: 'custId', refTable: 'customer', refColumn: 'custId', deleteRule: 'CASCADE' },
      { constraintName: 'subscription_planId_fkey', columnName: 'planId', refTable: 'plan', refColumn: 'planId', deleteRule: 'SET NULL' },
    ]
    const result = await syncTableSchema(runner(fkReales, ejecutadas), modelo, 'subscription', { applyChanges: true, applyForeignKeys: true })

    expect(result.foreignKeys).toEqual([])
    expect(ejecutadas.some((s) => s.includes('ADD CONSTRAINT'))).toBe(false)
  })

  it('recrea la FK que quedó con otra acción, y lo dice', async () => {
    const ejecutadas: string[] = []
    const fkReales = [
      { constraintName: 'subscription_planId_fkey', columnName: 'planId', refTable: 'plan', refColumn: 'planId', deleteRule: 'CASCADE' },
    ]
    const result = await syncTableSchema(runner(fkReales, ejecutadas), modelo, 'subscription', { applyChanges: true, applyForeignKeys: true })

    expect(result.foreignKeys).toContain('subscription_planId_fkey (SET NULL) [era CASCADE]')
    expect(ejecutadas.some((s) => s.includes('DROP CONSTRAINT IF EXISTS "subscription_planId_fkey"'))).toBe(true)
    expect(ejecutadas.some((s) => s.includes('ON DELETE SET NULL'))).toBe(true)
  })

  it('reconoce la FK por columna aunque tenga otro nombre: no crea una segunda', async () => {
    const ejecutadas: string[] = []
    const fkReales = [
      { constraintName: 'fk_legacy_plan', columnName: 'planId', refTable: 'plan', refColumn: 'planId', deleteRule: 'CASCADE' },
    ]
    await syncTableSchema(runner(fkReales, ejecutadas), modelo, 'subscription', { applyChanges: true, applyForeignKeys: true })

    expect(ejecutadas.some((s) => s.includes('DROP CONSTRAINT IF EXISTS "fk_legacy_plan"'))).toBe(true)
  })

  it('en modo evaluación reporta lo que haría sin ejecutarlo', async () => {
    const ejecutadas: string[] = []
    const result = await syncTableSchema(runner([], ejecutadas), modelo, 'subscription', { applyChanges: false, applyForeignKeys: true })

    expect(result.foreignKeys).toEqual(['subscription_custId_fkey (CASCADE) [would be created]', 'subscription_planId_fkey (SET NULL) [would be created]'])
    expect(ejecutadas.some((s) => s.startsWith('ALTER'))).toBe(false)
    expect(result.sql.filter((s) => s.includes('ADD CONSTRAINT'))).toHaveLength(2)
  })

  it('una FK que falla por datos huérfanos se reporta y no corta el resto', async () => {
    const ejecutadas: string[] = []
    const run: SqlRunner = async (sql) => {
      ejecutadas.push(sql)
      if (sql.includes('information_schema.table_constraints')) return []
      if (sql.includes('information_schema')) return columnasReales
      if (sql.includes('subscription_custId_fkey')) throw new Error('violates foreign key constraint')
      return []
    }
    const result = await syncTableSchema(run, modelo, 'subscription', { applyChanges: true, applyForeignKeys: true })

    expect(result.errors.join(' ')).toContain('violates foreign key constraint')
    expect(result.foreignKeys).toEqual(['subscription_planId_fkey (SET NULL)'])
  })

  it('una tabla creada de cero no necesita reconciliar nada: nace con sus FK', async () => {
    const ejecutadas: string[] = []
    const run: SqlRunner = async (sql) => {
      ejecutadas.push(sql)
      return []
    }
    const result = await syncTableSchema(run, modelo, 'subscription', { applyChanges: true, applyForeignKeys: true })

    expect(result.tableMissing).toBe(true)
    expect(result.foreignKeys).toEqual([])
    expect(ejecutadas.some((s) => s.includes('ON DELETE SET NULL'))).toBe(true)
  })
})
