export class errorMessages {
  static errorInDataFilters(humanLanguage: string) {
    if (humanLanguage === 'es') {
      return 'Error en los filtros de datos';
    }

    return "Error in data filters";
  }

  static errorDataCantInsert(humanLanguage: string) {
    if (humanLanguage === 'es') {
      return 'No se puede insertar el registro';
    }

    return "Can't insert record";
  }

  static errorDataInvalidStatus(humanLanguage: string, status: string) {
    if (humanLanguage === 'es') {
      return `El estado ${status} no es válido`;
    }

    return `Invalid status ${status}`;
  }

  static errorAnErrorOccurredIdDatabase(humanLanguage: string, idError: string) {
    if (humanLanguage === 'es') {
      return `Ocurrió un error en la base de datos ${idError}`;
    }

    return `An error has occurred in the database ${idError}`;
  }

  static errorAppVersionNotSupported(humanLanguage: string, minWebCompatibleVersion: string) {
    if (humanLanguage === 'es') {
      return `Versión de la aplicación no soportada, por favor actualice a la versión ${minWebCompatibleVersion} o superior`;
    }

    return `App version not supported, please update to version ${minWebCompatibleVersion} or higher`;
  }

  static errorCantDeleteInitialData(humanLanguage: string) {
    if (humanLanguage === 'es') {
      return 'No se puede eliminar el registro';
    }

    return "Can't delete this record";
  }

  static errorDataCantUpdate(humanLanguage: string) {
    if (humanLanguage === 'es') {
      return 'No se puede actualizar el registro, se encontró una versión distinta, actualice la información y vuelva a intentar';
    }

    return "Can't update record, different version found, please refresh the data and try again";
  }

  static errorDataCantUpdateColumn(humanLanguage: string, columnName: string) {
    if (humanLanguage === 'es') {
      return `No se puede actualizar el campo ${columnName}`;
    }

    return `Can't update field ${columnName}`;
  }

  static errorDataDoesntExist(humanLanguage: string, _moduleName: string, _recordId: string) {
    if (humanLanguage === 'es') {
      return 'El registro no existe';
    }

    return "Record doesn't exist";
  }

  static forbidden(humanLanguage: string) {
    if (humanLanguage === 'es') {
      return 'No tiene permisos para realizar esta acción';
    }

    return "You don't have permissions to do this action";
  }

  static errorLengthGreaterThan(humanLanguage: string, fieldName: string, value: unknown, length: number) {
    if (humanLanguage === 'es') {
      return `El campo ${fieldName} con valor "${value}" tiene una longitud mayor a ${length}`;
    }

    return `Field ${fieldName} with value "${value}" has a length greater than ${length}`;
  }

  static errorNotBoolean(humanLanguage: string, fieldName: string, value: unknown) {
    if (humanLanguage === 'es') {
      return `El campo ${fieldName} con valor "${value}" no es un booleano`;
    }

    return `Field ${fieldName} with value "${value}" is not a boolean`;
  }

  static errorNotNumber(humanLanguage: string, fieldName: string, value: unknown) {
    if (humanLanguage === 'es') {
      return `El campo ${fieldName} con valor "${value}" no es un número`;
    }

    return `Field ${fieldName} with value "${value}" is not a number`;
  }

  static errorMustBeGreaterThan(humanLanguage: string, fieldName: string, value: unknown, minValue: number) {
    if (humanLanguage === 'es') {
      return `El campo ${fieldName} con valor "${value}" debe ser mayor a ${minValue}`;
    }

    return `Field ${fieldName} with value "${value}" must be greater than ${minValue}`;
  }

  static errorDateFormat(humanLanguage: string, fieldName: string, value: unknown) {
    if (humanLanguage === 'es') {
      return `El campo ${fieldName} con valor "${value}" no es una fecha válida (yyyy-mm-dd hh:mi:ss.msi)`;
    }

    return `Field ${fieldName} with value "${value}" is not a valid date (yyyy-mm-dd hh:mi:ss.msi)`;
  }

  static errorDateValue(humanLanguage: string, fieldName: string, value: unknown) {
    if (humanLanguage === 'es') {
      return `El campo ${fieldName} con valor "${value}" no es una fecha válida`;
    }

    return `Field ${fieldName} with value "${value}" is not a valid date`;
  }

  static errorValueNotFound(humanLanguage: string, fieldName: string, value: unknown) {
    if (humanLanguage === 'es') {
      return `El campo ${fieldName} con valor "${value}" no se encontró o está vacío`;
    }

    return `Field ${fieldName} with value "${value}" not found or is empty`;
  }

  static errorOrgIdDifferent(humanLanguage: string, orgId: string) {
    if (humanLanguage === 'es') {
      return `El orgId ${orgId} es distinto al del token`;
    }

    return `The orgId ${orgId} is different from the token's`;
  }
}
