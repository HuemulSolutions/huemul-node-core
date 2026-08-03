import { describe, it, expect } from 'vitest'
import {
  parsePostgresType,
  typesMatch,
  canonicalFromColumnDef,
  canonicalFromInformationSchema,
  diffTableColumns,
  buildAddColumnSql,
  buildAlterColumnTypeSql,
  buildCreateTableSql,
  toSchemaColumn,
  syncTableSchema,
  informationSchemaColumnsSql,
  sqlDefaultLiteral,
  validateColumnDefault,
  validateColumnDefaults,
  quoteIdent,
  escapeSqlLiteral,
  validateIdentifier,
  validateColumnType,
  validateColumn,
  validateModel,
} from '../../src/gen-postgres-schema'
import type { ISchemaColumn, SqlRunner } from '../../src/gen-postgres-schema'
import type { IHuemulColumnDef } from '../../src/interfaces/interface-huemul-column-def'

// helper to build a column def with sensible defaults
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

// helper to build an information_schema row
function row(partial: Partial<ISchemaColumn> & { columnName: string; dataType: string }): ISchemaColumn {
  return {
    characterMaximumLength: null,
    numericPrecision: null,
    numericScale: null,
    isNullable: true,
    ...partial,
  }
}

// NUL explícito: escribirlo literal en el fuente deja un byte invisible
const NUL = String.fromCharCode(0)

describe('parsePostgresType', () => {
  it('parses varchar(N)', () => {
    expect(parsePostgresType('varchar(120)')).toEqual({ base: 'character varying', length: 120 })
  })
  it('parses NUMERIC(p, s) tolerating spaces/case', () => {
    expect(parsePostgresType('NUMERIC(19, 4)')).toEqual({ base: 'numeric', precision: 19, scale: 4 })
  })
  it('normalizes INT to integer', () => {
    expect(parsePostgresType('INT')).toEqual({ base: 'integer' })
  })
  it('normalizes TEXT / boolean / jsonb', () => {
    expect(parsePostgresType('TEXT')).toEqual({ base: 'text' })
    expect(parsePostgresType('boolean')).toEqual({ base: 'boolean' })
    expect(parsePostgresType('jsonb')).toEqual({ base: 'jsonb' })
  })
  it('normalizes timestamptz / TimeStamp / time', () => {
    expect(parsePostgresType('timestamptz')).toEqual({ base: 'timestamp with time zone' })
    expect(parsePostgresType('TimeStamp')).toEqual({ base: 'timestamp without time zone' })
    expect(parsePostgresType('time')).toEqual({ base: 'time without time zone' })
  })
})

describe('canonical helpers', () => {
  it('canonicalFromColumnDef for a string column', () => {
    expect(canonicalFromColumnDef(col({ columnName: 'subsName', columnType: 'string', columnLength: 120 })))
      .toEqual({ base: 'character varying', length: 120 })
  })
  it('canonicalFromColumnDef for a number/decimal column', () => {
    expect(canonicalFromColumnDef(col({ columnName: 'amount', columnType: 'number', columnLength: 19, columnPrecision: 4 })))
      .toEqual({ base: 'numeric', precision: 19, scale: 4 })
  })
  it('canonicalFromInformationSchema for varchar', () => {
    expect(canonicalFromInformationSchema(row({ columnName: 'x', dataType: 'character varying', characterMaximumLength: 50 })))
      .toEqual({ base: 'character varying', length: 50 })
  })
})

describe('typesMatch', () => {
  it('matches equal varchar lengths, differs when length changes', () => {
    expect(typesMatch({ base: 'character varying', length: 50 }, { base: 'character varying', length: 50 })).toBe(true)
    expect(typesMatch({ base: 'character varying', length: 120 }, { base: 'character varying', length: 50 })).toBe(false)
  })
  it('matches numeric on precision+scale', () => {
    expect(typesMatch({ base: 'numeric', precision: 19, scale: 4 }, { base: 'numeric', precision: 19, scale: 4 })).toBe(true)
    expect(typesMatch({ base: 'numeric', precision: 15, scale: 2 }, { base: 'numeric', precision: 19, scale: 4 })).toBe(false)
  })
  it('matches on base for simple types, differs on base', () => {
    expect(typesMatch({ base: 'boolean' }, { base: 'boolean' })).toBe(true)
    expect(typesMatch({ base: 'text' }, { base: 'character varying', length: 100 })).toBe(false)
  })
})

describe('toSchemaColumn', () => {
  it('maps camelCase alias rows and YES/NO nullable', () => {
    const sc = toSchemaColumn({ columnName: 'a', dataType: 'character varying', characterMaximumLength: 50, numericPrecision: null, numericScale: null, isNullable: 'NO' })
    expect(sc).toEqual({ columnName: 'a', dataType: 'character varying', characterMaximumLength: 50, numericPrecision: null, numericScale: null, isNullable: false })
  })
  it('maps snake_case rows and numeric strings', () => {
    const sc = toSchemaColumn({ column_name: 'b', data_type: 'numeric', character_maximum_length: null, numeric_precision: '19', numeric_scale: '4', is_nullable: 'YES' })
    expect(sc).toEqual({ columnName: 'b', dataType: 'numeric', characterMaximumLength: null, numericPrecision: 19, numericScale: 4, isNullable: true })
  })
})

describe('diffTableColumns', () => {
  const model: IHuemulColumnDef[] = [
    col({ columnName: 'subsId', columnType: 'string', columnLength: 50, pkType: 'manualPK', allowNull: false }),
    col({ columnName: 'subsName', columnType: 'string', columnLength: 120, allowNull: false }),
    col({ columnName: 'subsAmount', columnType: 'number', columnLength: 19, columnPrecision: 4 }),
  ]

  it('flags table missing when no rows', () => {
    const diff = diffTableColumns(model, [], 'subscription')
    expect(diff.tableMissing).toBe(true)
    expect(diff.toAdd).toHaveLength(0)
  })

  it('detects missing column, type change and extra column', () => {
    const actual: ISchemaColumn[] = [
      row({ columnName: 'subsId', dataType: 'character varying', characterMaximumLength: 50 }),
      row({ columnName: 'subsName', dataType: 'character varying', characterMaximumLength: 50 }), // model wants 120
      row({ columnName: 'legacyCol', dataType: 'text' }), // not in model
    ]
    const diff = diffTableColumns(model, actual, 'subscription')
    expect(diff.tableMissing).toBe(false)
    expect(diff.toAdd.map((c) => c.columnName)).toEqual(['subsAmount'])
    expect(diff.toAlter.map((c) => c.columnName)).toEqual(['subsName'])
    expect(diff.extra).toEqual(['legacyCol'])
  })

  it('no diff when everything matches', () => {
    const actual: ISchemaColumn[] = [
      row({ columnName: 'subsId', dataType: 'character varying', characterMaximumLength: 50 }),
      row({ columnName: 'subsName', dataType: 'character varying', characterMaximumLength: 120 }),
      row({ columnName: 'subsAmount', dataType: 'numeric', numericPrecision: 19, numericScale: 4 }),
    ]
    const diff = diffTableColumns(model, actual, 'subscription')
    expect(diff.toAdd).toHaveLength(0)
    expect(diff.toAlter).toHaveLength(0)
    expect(diff.extra).toHaveLength(0)
  })
})

describe('SQL builders', () => {
  it('buildAddColumnSql: NOT NULL column uses type-fallback default', () => {
    expect(buildAddColumnSql('subscription', col({ columnName: 'subsAmount', columnType: 'number', columnLength: 19, columnPrecision: 4, allowNull: false })))
      .toBe('ALTER TABLE "subscription" ADD COLUMN "subsAmount" NUMERIC(19, 4) NOT NULL DEFAULT 0')
  })
  it('buildAddColumnSql: NOT NULL fallbacks by type', () => {
    expect(buildAddColumnSql('t', col({ columnName: 'a', columnType: 'string', columnLength: 120, allowNull: false })))
      .toBe('ALTER TABLE "t" ADD COLUMN "a" varchar(120) NOT NULL DEFAULT \'\'')
    expect(buildAddColumnSql('t', col({ columnName: 'b', columnType: 'boolean', allowNull: false })))
      .toBe('ALTER TABLE "t" ADD COLUMN "b" boolean NOT NULL DEFAULT false')
    expect(buildAddColumnSql('t', col({ columnName: 'c', columnType: 'jsonb', allowNull: false })))
      .toBe('ALTER TABLE "t" ADD COLUMN "c" jsonb NOT NULL DEFAULT \'{}\'::jsonb')
  })
  it('buildAddColumnSql: uses model defaultValue and escapes quotes', () => {
    expect(buildAddColumnSql('t', col({ columnName: 'st', columnType: 'string', columnLength: 20, allowNull: false, defaultValue: 'active' })))
      .toBe('ALTER TABLE "t" ADD COLUMN "st" varchar(20) NOT NULL DEFAULT \'active\'')
    expect(buildAddColumnSql('t', col({ columnName: 'st', columnType: 'string', columnLength: 20, allowNull: false, defaultValue: "o'hara" })))
      .toBe('ALTER TABLE "t" ADD COLUMN "st" varchar(20) NOT NULL DEFAULT \'o\'\'hara\'')
  })
  it('buildAddColumnSql: nullable column with model default emits DEFAULT; without stays plain', () => {
    expect(buildAddColumnSql('t', col({ columnName: 'n', columnType: 'number', columnLength: 5, columnPrecision: 2, allowNull: true, defaultValue: 1 })))
      .toBe('ALTER TABLE "t" ADD COLUMN "n" NUMERIC(5, 2) DEFAULT 1')
    expect(buildAddColumnSql('t', col({ columnName: 'n2', columnType: 'string', columnLength: 30, allowNull: true })))
      .toBe('ALTER TABLE "t" ADD COLUMN "n2" varchar(30)')
  })
  it('buildAddColumnSql: defaultSql is emitted raw (unquoted) on a timestamptz column', () => {
    expect(buildAddColumnSql('t', col({ columnName: 'createdAt', columnType: 'timestamptz', allowNull: false, defaultSql: 'now()' })))
      .toBe('ALTER TABLE "t" ADD COLUMN "createdAt" timestamptz NOT NULL DEFAULT now()')
    expect(buildAddColumnSql('t', col({ columnName: 'updatedAt', columnType: 'timestamptz', allowNull: true, defaultSql: 'now()' })))
      .toBe('ALTER TABLE "t" ADD COLUMN "updatedAt" timestamptz DEFAULT now()')
  })
  it('buildAddColumnSql: keeps falsy literals instead of falling back by type', () => {
    expect(buildAddColumnSql('t', col({ columnName: 'flag', columnType: 'boolean', allowNull: true, defaultValue: false })))
      .toBe('ALTER TABLE "t" ADD COLUMN "flag" boolean DEFAULT false')
    expect(buildAddColumnSql('t', col({ columnName: 'qty', columnType: 'number', allowNull: true, defaultValue: 0 })))
      .toBe('ALTER TABLE "t" ADD COLUMN "qty" INT DEFAULT 0')
  })
  it('sqlDefaultLiteral: defaultSql wins over defaultValue (defined precedence, even though it is invalid metadata)', () => {
    expect(sqlDefaultLiteral(col({ columnName: 'createdAt', columnType: 'timestamptz', defaultSql: 'now()', defaultValue: 'ignored' })))
      .toBe('now()')
  })
  it('buildCreateTableSql emits defaultSql raw', () => {
    const sql = buildCreateTableSql([
      col({ columnName: 'createdAt', columnType: 'timestamptz', allowNull: false, defaultSql: 'now()' }),
    ], 'subscription')
    expect(sql).toContain('"createdAt" timestamptz NOT NULL DEFAULT now()')
  })
  it('buildAlterColumnTypeSql casts with USING', () => {
    expect(buildAlterColumnTypeSql('subscription', col({ columnName: 'subsName', columnType: 'string', columnLength: 120 })))
      .toBe('ALTER TABLE "subscription" ALTER COLUMN "subsName" TYPE varchar(120) USING "subsName"::varchar(120)')
  })
  it('buildCreateTableSql includes columns, PK and FK; DEFAULT only when declared', () => {
    const sql = buildCreateTableSql([
      col({ columnName: 'subsId', columnType: 'string', columnLength: 50, pkType: 'manualPK', allowNull: false }),
      col({ columnName: 'subsStatus', columnType: 'string', columnLength: 20, allowNull: false, defaultValue: 'pending' }),
      col({ columnName: 'custId', columnType: 'string', columnLength: 50, PKModuleName: 'customer', PKModuleNameId: 'custId' }),
    ], 'subscription')
    expect(sql).toContain('CREATE TABLE "subscription"')
    // NOT NULL sin default declarado NO fuerza DEFAULT en CREATE
    expect(sql).toContain('"subsId" varchar(50) NOT NULL')
    expect(sql).not.toContain('"subsId" varchar(50) NOT NULL DEFAULT')
    // NOT NULL con default declarado SÍ lo emite
    expect(sql).toContain('"subsStatus" varchar(20) NOT NULL DEFAULT \'pending\'')
    expect(sql).toContain('PRIMARY KEY ("subsId")')
    expect(sql).toContain('FOREIGN KEY ("custId") REFERENCES "customer"("custId") ON DELETE CASCADE')
  })
})

describe('validateColumnDefault', () => {
  it('returns null when there is no default at all', () => {
    expect(validateColumnDefault(col({ columnName: 'a', columnType: 'string', columnLength: 20 }))).toBeNull()
  })
  it('returns null for coherent defaults', () => {
    expect(validateColumnDefault(col({ columnName: 'a', columnType: 'string', columnLength: 20, defaultValue: 'active' }))).toBeNull()
    expect(validateColumnDefault(col({ columnName: 'b', columnType: 'number', defaultValue: 0 }))).toBeNull()
    expect(validateColumnDefault(col({ columnName: 'c', columnType: 'number', defaultValue: '12.5' }))).toBeNull()
    expect(validateColumnDefault(col({ columnName: 'd', columnType: 'boolean', defaultValue: false }))).toBeNull()
    expect(validateColumnDefault(col({ columnName: 'e', columnType: 'boolean', defaultValue: 'TRUE' }))).toBeNull()
    expect(validateColumnDefault(col({ columnName: 'f', columnType: 'jsonb', defaultValue: '{"a":1}' }))).toBeNull()
    expect(validateColumnDefault(col({ columnName: 'g', columnType: 'timestamptz', defaultSql: 'now()' }))).toBeNull()
  })
  it('rejects declaring defaultSql and defaultValue together', () => {
    expect(validateColumnDefault(col({ columnName: 'a', columnType: 'timestamptz', defaultSql: 'now()', defaultValue: 'x' })))
      .toContain('excluyentes')
  })
  it('rejects a blank defaultSql', () => {
    expect(validateColumnDefault(col({ columnName: 'a', columnType: 'timestamptz', defaultSql: '   ' })))
      .toContain('en blanco')
  })
  it('rejects a non-numeric default on a number column', () => {
    expect(validateColumnDefault(col({ columnName: 'amount', columnType: 'number', defaultValue: 'abc' })))
      .toContain('no es numérico')
  })
  it('rejects a non-boolean default on a boolean column', () => {
    expect(validateColumnDefault(col({ columnName: 'flag', columnType: 'boolean', defaultValue: 'yes' })))
      .toContain('no es booleano')
  })
  it('rejects invalid JSON on a jsonb column', () => {
    expect(validateColumnDefault(col({ columnName: 'meta', columnType: 'jsonb', defaultValue: '{not json' })))
      .toContain('JSON válido')
  })
  it('rejects a string default longer than the resulting varchar', () => {
    expect(validateColumnDefault(col({ columnName: 'code', columnType: 'string', columnLength: 5, defaultValue: 'demasiado largo' })))
      .toContain('excede el varchar(5)')
    // color siempre mapea a varchar(10), sin declarar columnLength
    expect(validateColumnDefault(col({ columnName: 'tone', columnType: 'color', defaultValue: '#AABBCCDDEE00' })))
      .toContain('excede el varchar(10)')
  })
  it('validateColumnDefaults collects only the invalid ones', () => {
    const errors = validateColumnDefaults([
      col({ columnName: 'ok', columnType: 'string', columnLength: 20, defaultValue: 'active' }),
      col({ columnName: 'bad1', columnType: 'number', defaultValue: 'abc' }),
      col({ columnName: 'bad2', columnType: 'boolean', defaultValue: 'yes' }),
    ])
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('bad1')
    expect(errors[1]).toContain('bad2')
  })
})

describe('syncTableSchema', () => {
  const model: IHuemulColumnDef[] = [
    col({ columnName: 'subsId', columnType: 'string', columnLength: 50, pkType: 'manualPK', allowNull: false }),
    col({ columnName: 'subsName', columnType: 'string', columnLength: 120, allowNull: false }),
    col({ columnName: 'subsAmount', columnType: 'number', columnLength: 19, columnPrecision: 4, allowNull: false }),
  ]

  const actualRows = [
    { columnName: 'subsId', dataType: 'character varying', characterMaximumLength: 50, numericPrecision: null, numericScale: null, isNullable: 'NO' },
    { columnName: 'subsName', dataType: 'character varying', characterMaximumLength: 50, numericPrecision: null, numericScale: null, isNullable: 'NO' },
  ]

  it('evaluate mode: reports diff and generates SQL but never executes DDL', async () => {
    const executed: string[] = []
    const run: SqlRunner = async (sql) => {
      executed.push(sql)
      if (sql.includes('information_schema')) return actualRows
      return []
    }
    const result = await syncTableSchema(run, model, 'subscription', { applyChanges: false })
    expect(result.added).toEqual(['subsAmount'])
    expect(result.typeChanged).toEqual(['subsName (character varying(50) -> varchar(120))'])
    expect(result.sql).toContain('ALTER TABLE "subscription" ADD COLUMN "subsAmount" NUMERIC(19, 4) NOT NULL DEFAULT 0')
    expect(result.sql).toHaveLength(2)
    // only the introspection SELECT ran; no ALTER executed
    expect(executed.filter((s) => s.startsWith('ALTER'))).toHaveLength(0)
  })

  it('apply mode: executes the generated ALTER statements', async () => {
    const executed: string[] = []
    const run: SqlRunner = async (sql) => {
      executed.push(sql)
      if (sql.includes('information_schema')) return actualRows
      return []
    }
    const result = await syncTableSchema(run, model, 'subscription', { applyChanges: true })
    const alters = executed.filter((s) => s.startsWith('ALTER'))
    expect(alters).toContain('ALTER TABLE "subscription" ADD COLUMN "subsAmount" NUMERIC(19, 4) NOT NULL DEFAULT 0')
    expect(alters).toContain('ALTER TABLE "subscription" ALTER COLUMN "subsName" TYPE varchar(120) USING "subsName"::varchar(120)')
    expect(result.errors).toHaveLength(0)
  })

  it('applyTypeChanges=false: skips type changes but still adds columns', async () => {
    const executed: string[] = []
    const run: SqlRunner = async (sql) => {
      executed.push(sql)
      if (sql.includes('information_schema')) return actualRows
      return []
    }
    const result = await syncTableSchema(run, model, 'subscription', { applyChanges: true, applyTypeChanges: false })
    expect(executed).toContain('ALTER TABLE "subscription" ADD COLUMN "subsAmount" NUMERIC(19, 4) NOT NULL DEFAULT 0')
    expect(executed.some((s) => s.includes('ALTER COLUMN'))).toBe(false)
    expect(result.typeChanged[0]).toContain('skipped: applyTypeChanges=false')
  })

  it('creates the table when it does not exist (apply mode)', async () => {
    const executed: string[] = []
    const run: SqlRunner = async (sql) => {
      executed.push(sql)
      if (sql.includes('information_schema')) return []
      return []
    }
    const result = await syncTableSchema(run, model, 'subscription', { applyChanges: true })
    expect(result.tableMissing).toBe(true)
    expect(executed.some((s) => s.startsWith('CREATE TABLE "subscription"'))).toBe(true)
    expect(result.added).toEqual(['(table created)'])
  })

  it('reports an invalid default on a column to add, skips it and keeps the rest', async () => {
    const modelWithBadDefault: IHuemulColumnDef[] = [
      ...model,
      col({ columnName: 'subsFlag', columnType: 'boolean', allowNull: false, defaultValue: 'yes' }),
    ]
    const executed: string[] = []
    const run: SqlRunner = async (sql) => {
      executed.push(sql)
      if (sql.includes('information_schema')) return actualRows
      return []
    }
    const result = await syncTableSchema(run, modelWithBadDefault, 'subscription', { applyChanges: true })
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('add subscription.subsFlag')
    expect(result.sql.some((s) => s.includes('subsFlag'))).toBe(false)
    expect(executed.some((s) => s.includes('subsFlag'))).toBe(false)
    // la columna sana del mismo lote sí se procesa
    expect(result.added).toEqual(['subsAmount'])
  })

  it('does not offer or run CREATE TABLE when any default is invalid', async () => {
    const modelWithBadDefault: IHuemulColumnDef[] = [
      ...model,
      col({ columnName: 'subsFlag', columnType: 'boolean', allowNull: false, defaultValue: 'yes' }),
    ]
    const executed: string[] = []
    const run: SqlRunner = async (sql) => {
      executed.push(sql)
      return []
    }
    const result = await syncTableSchema(run, modelWithBadDefault, 'subscription', { applyChanges: true })
    expect(result.tableMissing).toBe(true)
    expect(result.errors[0]).toContain('create subscription')
    expect(result.sql).toHaveLength(0)
    expect(executed.some((s) => s.startsWith('CREATE TABLE'))).toBe(false)
  })

  it('rejects an unsafe tableName before running any query', async () => {
    const executed: string[] = []
    const run: SqlRunner = async (sql) => {
      executed.push(sql)
      return []
    }
    const result = await syncTableSchema(run, model, "x'; DROP TABLE users; --", { applyChanges: true })
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('tableName')
    // ni siquiera se ejecutó la introspección
    expect(executed).toHaveLength(0)
    expect(result.sql).toHaveLength(0)
  })

  it('rejects an unsafe columnType on the alter path without emitting the ALTER', async () => {
    const executed: string[] = []
    const run: SqlRunner = async (sql) => {
      executed.push(sql)
      if (sql.includes('information_schema')) {
        return [{ columnName: 'subsName', dataType: 'character varying', characterMaximumLength: 50, numericPrecision: null, numericScale: null, isNullable: 'NO' }]
      }
      return []
    }
    // el modelo pide un tipo distinto al real (dispara toAlter) y el tipo lleva SQL embebido
    const evil: IHuemulColumnDef[] = [col({ columnName: 'subsName', columnType: 'text; DROP TABLE users; --', allowNull: false })]
    const result = await syncTableSchema(run, evil, 'subscription', { applyChanges: true })
    expect(result.errors.some((e) => e.includes('no tiene una forma válida'))).toBe(true)
    expect(result.sql).toHaveLength(0)
    expect(executed.some((s) => s.includes('DROP TABLE'))).toBe(false)
    expect(executed.every((s) => s.includes('information_schema'))).toBe(true)
  })

  it('collects errors without throwing when a statement fails', async () => {
    const run: SqlRunner = async (sql) => {
      if (sql.includes('information_schema')) return actualRows
      throw new Error('boom')
    }
    const result = await syncTableSchema(run, model, 'subscription', { applyChanges: true })
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('informationSchemaColumnsSql', () => {
  it('targets the given table in public schema', () => {
    const sql = informationSchemaColumnsSql('subscription')
    expect(sql).toContain("table_name = 'subscription'")
    expect(sql).toContain("table_schema = 'public'")
  })
  it('escapes single quotes so a crafted tableName cannot close the literal', () => {
    const sql = informationSchemaColumnsSql("x' OR '1'='1")
    // la comilla queda duplicada: el literal nunca se cierra antes de tiempo
    expect(sql).toContain("table_name = 'x'' OR ''1''=''1'")
    expect(sql).not.toContain("OR '1'='1'")
  })
  it('escapes a statement-terminating payload', () => {
    const sql = informationSchemaColumnsSql("t'; DROP TABLE users; --")
    expect(sql).toContain("'t''; DROP TABLE users; --'")
  })
})

describe('escaping helpers', () => {
  it('quoteIdent wraps and doubles internal double quotes', () => {
    expect(quoteIdent('subsName')).toBe('"subsName"')
    expect(quoteIdent('a" boolean); DROP TABLE t; --')).toBe('"a"" boolean); DROP TABLE t; --"')
  })
  it('quoteIdent strips NUL bytes', () => {
    expect(quoteIdent(`ab${NUL}cd`)).toBe('"abcd"')
  })
  it('escapeSqlLiteral doubles single quotes and keeps everything else intact', () => {
    expect(escapeSqlLiteral("o'hara")).toBe("o''hara")
    // regresión: los espacios y el resto del contenido no se tocan
    expect(escapeSqlLiteral('hola mundo con espacios')).toBe('hola mundo con espacios')
    expect(escapeSqlLiteral(`a${NUL}b`)).toBe('ab')
  })
})

describe('SQL builders — identifier escaping', () => {
  it('buildAddColumnSql escapes a crafted columnName', () => {
    expect(buildAddColumnSql('t', col({ columnName: 'a"); DROP TABLE t; --', columnType: 'boolean', allowNull: true })))
      .toBe('ALTER TABLE "t" ADD COLUMN "a""); DROP TABLE t; --" boolean')
  })
  it('buildCreateTableSql escapes tableName, columnName and FK identifiers', () => {
    const sql = buildCreateTableSql([
      col({ columnName: 'ev"il', columnType: 'boolean', pkType: 'manualPK', allowNull: false }),
      col({ columnName: 'ref', columnType: 'string', columnLength: 10, PKModuleName: 'ta"ble', PKModuleNameId: 'i"d' }),
    ], 'my"table')
    expect(sql).toContain('CREATE TABLE "my""table"')
    expect(sql).toContain('"ev""il" boolean NOT NULL')
    expect(sql).toContain('PRIMARY KEY ("ev""il")')
    expect(sql).toContain('REFERENCES "ta""ble"("i""d")')
  })
  it('buildAlterColumnTypeSql escapes the column on both interpolations', () => {
    expect(buildAlterColumnTypeSql('t', col({ columnName: 'a"b', columnType: 'string', columnLength: 20 })))
      .toBe('ALTER TABLE "t" ALTER COLUMN "a""b" TYPE varchar(20) USING "a""b"::varchar(20)')
  })
})

describe('validateIdentifier', () => {
  it('accepts a normal identifier', () => {
    expect(validateIdentifier('subsName', 'columnName')).toBeNull()
  })
  it('rejects empty or whitespace-only', () => {
    expect(validateIdentifier('', 'columnName')).toContain('vacío')
    expect(validateIdentifier('   ', 'tableName')).toContain('vacío')
  })
  it('rejects double quotes, single quotes, semicolons and control chars', () => {
    expect(validateIdentifier('a"b', 'columnName')).toContain('comillas dobles')
    expect(validateIdentifier("x' OR '1'='1", 'tableName')).toContain('comillas o punto y coma')
    expect(validateIdentifier('t; DROP TABLE users', 'tableName')).toContain('comillas o punto y coma')
    expect(validateIdentifier(`a${NUL}b`, 'columnName')).toContain('caracteres de control')
    expect(validateIdentifier('a\nb', 'columnName')).toContain('caracteres de control')
  })
  it('accepts accented and hyphenated names, which quoteIdent handles safely', () => {
    expect(validateIdentifier('año', 'columnName')).toBeNull()
    expect(validateIdentifier('mi-tabla', 'tableName')).toBeNull()
  })
  it('rejects identifiers over 63 bytes, counting bytes and not characters', () => {
    // 32 caracteres 'ñ' = 64 bytes en UTF-8: pasaría un chequeo por largo de string
    const name = 'ñ'.repeat(32)
    expect(name.length).toBe(32)
    expect(validateIdentifier(name, 'columnName')).toContain('63 bytes')
    expect(validateIdentifier('a'.repeat(63), 'columnName')).toBeNull()
    expect(validateIdentifier('a'.repeat(64), 'columnName')).toContain('63 bytes')
  })
})

describe('validateColumnType', () => {
  it('accepts every shape dataTypeToPostgres produces', () => {
    expect(validateColumnType(col({ columnName: 'a', columnType: 'string', columnLength: 120 }))).toBeNull()
    expect(validateColumnType(col({ columnName: 'b', columnType: 'number', columnLength: 19, columnPrecision: 4 }))).toBeNull()
    expect(validateColumnType(col({ columnName: 'c', columnType: 'number' }))).toBeNull()
    expect(validateColumnType(col({ columnName: 'd', columnType: 'boolean' }))).toBeNull()
    expect(validateColumnType(col({ columnName: 'e', columnType: 'timestamptz' }))).toBeNull()
    expect(validateColumnType(col({ columnName: 'f', columnType: 'time' }))).toBeNull()
  })
  it('accepts passthrough types that are legitimate SQL', () => {
    expect(validateColumnType(col({ columnName: 'a', columnType: 'jsonb' }))).toBeNull()
    expect(validateColumnType(col({ columnName: 'b', columnType: 'timestamp with time zone' }))).toBeNull()
    expect(validateColumnType(col({ columnName: 'c', columnType: 'int[]' }))).toBeNull()
    expect(validateColumnType(col({ columnName: 'd', columnType: 'public.my_enum' }))).toBeNull()
  })
  it('rejects a columnType carrying SQL, which dataTypeToPostgres passes through raw', () => {
    expect(validateColumnType(col({ columnName: 'a', columnType: 'int; DROP TABLE users; --' })))
      .toContain('no tiene una forma válida')
    expect(validateColumnType(col({ columnName: 'b', columnType: "int DEFAULT 'x'" })))
      .toContain('no tiene una forma válida')
    expect(validateColumnType(col({ columnName: 'c', columnType: 'int(1+1)' })))
      .toContain('no tiene una forma válida')
  })
})

describe('validateColumn / validateModel', () => {
  it('validateColumn aggregates identifier, type and default problems', () => {
    const errors = validateColumn(col({ columnName: 'a"b', columnType: 'int; DROP TABLE t; --' }))
    expect(errors).toHaveLength(2)
    expect(errors[0]).toContain('comillas dobles')
    expect(errors[1]).toContain('no tiene una forma válida')
  })
  it('validateColumn checks FK identifiers only when a FK is declared', () => {
    expect(validateColumn(col({ columnName: 'ref', columnType: 'string', columnLength: 10, PKModuleName: 'ta"ble', PKModuleNameId: 'id' })))
      .toEqual([expect.stringContaining('PKModuleName')])
    expect(validateColumn(col({ columnName: 'ref', columnType: 'string', columnLength: 10 }))).toEqual([])
  })
  it('validateModel includes the table name', () => {
    const errors = validateModel([col({ columnName: 'ok', columnType: 'boolean' })], 'ta"ble')
    expect(errors).toEqual([expect.stringContaining('tableName')])
  })
  it('validateModel returns empty for a clean model', () => {
    expect(validateModel([col({ columnName: 'ok', columnType: 'boolean' })], 'subscription')).toEqual([])
  })
})
