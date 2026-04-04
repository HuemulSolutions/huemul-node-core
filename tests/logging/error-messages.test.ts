import { describe, it, expect } from 'vitest'
import { errorMessages } from '../../src/logging/huemul-error-messages'

// Helper to check both language variants for a method
function testBothLanguages(
  method: (lang: string, ...args: any[]) => string,
  args: any[],
  esExpected: string,
  enExpected: string,
) {
  expect(method('es', ...args)).toBe(esExpected)
  expect(method('en', ...args)).toBe(enExpected)
  expect(method('fr', ...args)).toBe(enExpected) // unsupported language falls back to English
}

describe('errorMessages — no-parameter methods', () => {
  it('errorInDataFilters', () => {
    testBothLanguages(
      errorMessages.errorInDataFilters.bind(errorMessages),
      [],
      'Error en los filtros de datos',
      'Error in data filters',
    )
  })

  it('errorDataCantInsert', () => {
    testBothLanguages(
      errorMessages.errorDataCantInsert.bind(errorMessages),
      [],
      'No se puede insertar el registro',
      "Can't insert record",
    )
  })

  it('errorCantDeleteInitialData', () => {
    testBothLanguages(
      errorMessages.errorCantDeleteInitialData.bind(errorMessages),
      [],
      'No se puede eliminar el registro',
      "Can't delete this record",
    )
  })

  it('errorDataCantUpdate', () => {
    expect(errorMessages.errorDataCantUpdate('es')).toContain('actualizar')
    expect(errorMessages.errorDataCantUpdate('en')).toContain("Can't update record")
  })

  it('forbidden', () => {
    testBothLanguages(
      errorMessages.forbidden.bind(errorMessages),
      [],
      'No tiene permisos para realizar esta acción',
      "You don't have permissions to do this action",
    )
  })
})

describe('errorMessages — methods with parameters', () => {
  it('errorDataInvalidStatus interpolates status', () => {
    expect(errorMessages.errorDataInvalidStatus('es', 'BORRADO'))
      .toBe('El estado BORRADO no es válido')
    expect(errorMessages.errorDataInvalidStatus('en', 'DELETED'))
      .toBe('Invalid status DELETED')
  })

  it('errorAnErrorOccurredIdDatabase interpolates errorId', () => {
    expect(errorMessages.errorAnErrorOccurredIdDatabase('es', 'DB-001'))
      .toContain('DB-001')
    expect(errorMessages.errorAnErrorOccurredIdDatabase('en', 'DB-001'))
      .toContain('DB-001')
  })

  it('errorAppVersionNotSupported interpolates version', () => {
    expect(errorMessages.errorAppVersionNotSupported('es', '2.0.0'))
      .toContain('2.0.0')
    expect(errorMessages.errorAppVersionNotSupported('en', '2.0.0'))
      .toContain('2.0.0')
  })

  it('errorDataCantUpdateColumn interpolates columnName', () => {
    expect(errorMessages.errorDataCantUpdateColumn('es', 'email'))
      .toContain('email')
    expect(errorMessages.errorDataCantUpdateColumn('en', 'email'))
      .toContain('email')
  })

  it('errorDataDoesntExist returns fixed message regardless of params', () => {
    expect(errorMessages.errorDataDoesntExist('es', 'Module', '123'))
      .toBe('El registro no existe')
    expect(errorMessages.errorDataDoesntExist('en', 'Module', '123'))
      .toBe("Record doesn't exist")
  })

  it('errorLengthGreaterThan interpolates fieldName, value, and length', () => {
    const es = errorMessages.errorLengthGreaterThan('es', 'nombre', 'abcdef', 5)
    expect(es).toContain('nombre')
    expect(es).toContain('abcdef')
    expect(es).toContain('5')

    const en = errorMessages.errorLengthGreaterThan('en', 'nombre', 'abcdef', 5)
    expect(en).toContain('nombre')
    expect(en).toContain('abcdef')
    expect(en).toContain('5')
  })

  it('errorNotBoolean interpolates fieldName and value', () => {
    expect(errorMessages.errorNotBoolean('es', 'activo', 'maybe'))
      .toContain('activo')
    expect(errorMessages.errorNotBoolean('en', 'active', 'maybe'))
      .toContain('active')
  })

  it('errorNotNumber interpolates fieldName and value', () => {
    expect(errorMessages.errorNotNumber('es', 'edad', 'abc'))
      .toContain('edad')
    expect(errorMessages.errorNotNumber('en', 'age', 'abc'))
      .toContain('age')
  })

  it('errorMustBeGreaterThan interpolates fieldName, value, and minValue', () => {
    const es = errorMessages.errorMustBeGreaterThan('es', 'cantidad', 0, 1)
    expect(es).toContain('cantidad')
    expect(es).toContain('1')
  })

  it('errorDateFormat interpolates fieldName and value', () => {
    expect(errorMessages.errorDateFormat('es', 'fechaNacimiento', 'not-a-date'))
      .toContain('fechaNacimiento')
    expect(errorMessages.errorDateFormat('en', 'birthDate', 'not-a-date'))
      .toContain('birthDate')
  })

  it('errorDateValue interpolates fieldName and value', () => {
    expect(errorMessages.errorDateValue('es', 'fecha', 'invalid'))
      .toContain('fecha')
    expect(errorMessages.errorDateValue('en', 'date', 'invalid'))
      .toContain('date')
  })

  it('errorValueNotFound interpolates fieldName and value', () => {
    expect(errorMessages.errorValueNotFound('es', 'userId', null))
      .toContain('userId')
    expect(errorMessages.errorValueNotFound('en', 'userId', null))
      .toContain('userId')
  })

  it('errorOrgIdDifferent interpolates orgId', () => {
    expect(errorMessages.errorOrgIdDifferent('es', 'ORG-123'))
      .toContain('ORG-123')
    expect(errorMessages.errorOrgIdDifferent('en', 'ORG-123'))
      .toContain('ORG-123')
  })
})
