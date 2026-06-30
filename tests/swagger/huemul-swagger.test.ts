import { describe, it, expect, vi } from 'vitest'
import {
  huemulColumnToOpenApi,
  buildModuleSchemas,
  buildCrudPaths,
  buildExtraPaths,
  buildHuemulOpenApiPaths,
  huemulResponseComponents,
} from '../../src/swagger/huemul-swagger'

describe('huemulColumnToOpenApi', () => {
  it('string con columnLength → maxLength', () => {
    const p = huemulColumnToOpenApi({ columnType: 'string', columnLength: 50 } as any)
    expect(p).toMatchObject({ type: 'string', maxLength: 50 })
  })

  it('number sin precision → integer', () => {
    const p = huemulColumnToOpenApi({ columnType: 'number' } as any)
    expect(p).toEqual({ type: 'integer' })
  })

  it('number con columnPrecision > 0 → number/double', () => {
    const p = huemulColumnToOpenApi({ columnType: 'number', columnPrecision: 4 } as any)
    expect(p).toMatchObject({ type: 'number', format: 'double' })
  })

  it('boolean → boolean', () => {
    const p = huemulColumnToOpenApi({ columnType: 'boolean' } as any)
    expect(p).toEqual({ type: 'boolean' })
  })

  it('date → string/date', () => {
    const p = huemulColumnToOpenApi({ columnType: 'date' } as any)
    expect(p).toMatchObject({ type: 'string', format: 'date' })
  })

  it('timestamp (case-insensitive) → string/date-time', () => {
    const p = huemulColumnToOpenApi({ columnType: 'TimeStamp' } as any)
    expect(p).toMatchObject({ type: 'string', format: 'date-time' })
  })

  it('picker → prefijo [picker] en description', () => {
    const p = huemulColumnToOpenApi({ columnType: 'picker', columnDescription: 'estado' } as any)
    expect(p.type).toBe('string')
    expect((p as any).description).toBe('[picker] estado')
  })

  it('tipo desconocido → string', () => {
    const p = huemulColumnToOpenApi({ columnType: 'whatever' } as any)
    expect(p).toEqual({ type: 'string' })
  })

  it('FK (PKModuleName) agrega descripción', () => {
    const p = huemulColumnToOpenApi({
      columnType: 'string',
      columnDescription: 'ref',
      PKModuleName: 'gcClient',
      PKModuleNameId: 'gcClientId',
    } as any)
    expect((p as any).description).toContain('(FK -> gcClient.gcClientId)')
  })
})

describe('buildModuleSchemas', () => {
  const columns = [
    { columnName: 'gcCountryId', columnType: 'string', required: true, allowNull: false },
    { columnName: 'name', columnType: 'string', required: true, allowNull: false },
    { columnName: 'optional', columnType: 'string', required: false, allowNull: true },
    { columnName: 'cdcState', columnType: 'number', required: true, allowNull: true },
    { columnName: 'versionKey', columnType: 'string', required: true, allowNull: true },
  ] as any[]

  it('genera schema full y schema Body', () => {
    const schemas = buildModuleSchemas('gcCountry', columns)
    expect(schemas.gcCountry).toBeDefined()
    expect(schemas.gcCountryBody).toBeDefined()
  })

  it('el schema Body excluye columnas base pero conserva versionKey', () => {
    const schemas = buildModuleSchemas('gcCountry', columns) as any
    const bodyProps = schemas.gcCountryBody.properties
    expect(bodyProps.cdcState).toBeUndefined()
    expect(bodyProps.versionKey).toBeDefined()
    expect(bodyProps.gcCountryId).toBeDefined()
  })

  it('required[] incluye solo columnas con required && !allowNull', () => {
    const schemas = buildModuleSchemas('gcCountry', columns) as any
    expect(schemas.gcCountryBody.required).toEqual(['gcCountryId', 'name'])
  })
})

describe('buildCrudPaths', () => {
  const def = { module: 'gcCountry', prefix: '/gcCountry' }

  it('genera las 6 rutas CRUD', () => {
    const paths = buildCrudPaths(def) as any
    expect(paths['/api/gcCountry/v1/'].post).toBeDefined()
    expect(paths['/api/gcCountry/v1/'].put).toBeDefined()
    expect(paths['/api/gcCountry/v1/'].get).toBeDefined()
    expect(paths['/api/gcCountry/v1/{gcCountryId}'].get).toBeDefined()
    expect(paths['/api/gcCountry/v1/{gcCountryId}'].delete).toBeDefined()
    expect(paths['/api/gcCountry/multi/delete/v1/'].put).toBeDefined()
  })

  it('el path param usa pkName cuando se provee', () => {
    const paths = buildCrudPaths({ ...def, pkName: 'countryCode' }) as any
    expect(paths['/api/gcCountry/v1/{countryCode}']).toBeDefined()
  })

  it('el body de multi-delete pide <module>IdList', () => {
    const paths = buildCrudPaths(def) as any
    const schema = paths['/api/gcCountry/multi/delete/v1/'].put.requestBody
      .content['application/json'].schema
    expect(schema.properties.gcCountryIdList).toBeDefined()
    expect(schema.required).toEqual(['gcCountryIdList'])
  })

  it('respeta standardCrud:false → sin rutas', () => {
    expect(buildCrudPaths({ ...def, standardCrud: false })).toEqual({})
  })
})

describe('buildExtraPaths', () => {
  const def = { module: 'gcCountry', prefix: '/gcCountry' }

  it('multipart genera multipart/form-data con file binary', () => {
    const paths = buildExtraPaths({
      ...def,
      extra: [{ method: 'post', path: '/upload/v1/', multipart: true }],
    }) as any
    const body = paths['/api/gcCountry/upload/v1/'].post.requestBody
    const schema = body.content['multipart/form-data'].schema
    expect(schema.properties.file).toMatchObject({ type: 'string', format: 'binary' })
  })

  it('bodySchema genera application/json', () => {
    const paths = buildExtraPaths({
      ...def,
      extra: [{ method: 'post', path: '/custom/v1/', bodySchema: { type: 'object' } }],
    }) as any
    const body = paths['/api/gcCountry/custom/v1/'].post.requestBody
    expect(body.content['application/json'].schema).toEqual({ type: 'object' })
  })

  it('convierte :param de Express a {param} de OpenAPI con path param', () => {
    const paths = buildExtraPaths({
      ...def,
      extra: [{ method: 'get', path: '/byCode/:code/v1/' }],
    }) as any
    const op = paths['/api/gcCountry/byCode/{code}/v1/'].get
    expect(op).toBeDefined()
    expect(op.parameters.some((p: any) => p.name === 'code' && p.in === 'path')).toBe(true)
  })
})

describe('buildHuemulOpenApiPaths', () => {
  it('loader que devuelve undefined → console.warn y continúa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = buildHuemulOpenApiPaths(
      [{ module: 'gcCountry', prefix: '/gcCountry' }],
      () => undefined,
    )
    expect(warn).toHaveBeenCalled()
    expect(Object.keys(result.paths)).toHaveLength(0)
    expect(Object.keys(result.schemas)).toHaveLength(0)
    warn.mockRestore()
  })

  it('respeta standardCrud:false (sin CRUD pero sí extra)', () => {
    const result = buildHuemulOpenApiPaths(
      [{
        module: 'gcCountry',
        prefix: '/gcCountry',
        standardCrud: false,
        extra: [{ method: 'post', path: '/upload/v1/', multipart: true }],
      }],
      () => [{ columnName: 'gcCountryId', columnType: 'string', required: true, allowNull: false } as any],
    )
    expect(result.paths['/api/gcCountry/v1/']).toBeUndefined()
    expect(result.paths['/api/gcCountry/upload/v1/']).toBeDefined()
    expect(Object.keys(result.schemas)).toHaveLength(0)
  })

  it('módulo válido genera paths CRUD y schemas', () => {
    const result = buildHuemulOpenApiPaths(
      [{ module: 'gcCountry', prefix: '/gcCountry' }],
      () => [{ columnName: 'gcCountryId', columnType: 'string', required: true, allowNull: false } as any],
    )
    expect(result.paths['/api/gcCountry/v1/']).toBeDefined()
    expect(result.schemas.gcCountry).toBeDefined()
  })
})

describe('huemulResponseComponents', () => {
  it('expone schema HuemulResponse y las 6 responses reutilizables', () => {
    const { schemas, responses } = huemulResponseComponents()
    expect(schemas.HuemulResponse).toBeDefined()
    expect(responses.HuemulOk200).toBeDefined()
    expect(responses.HuemulCreated201).toBeDefined()
    expect(responses.HuemulBadRequest400).toBeDefined()
    expect(responses.HuemulUnauthorized401).toBeDefined()
    expect(responses.HuemulForbidden403).toBeDefined()
    expect(responses.HuemulServerError500).toBeDefined()
  })
})
