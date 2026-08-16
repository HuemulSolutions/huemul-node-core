/* eslint max-len: ["error", { "code": 400 }] */
//version 1.0.4 2026-08-16 SRODRIGUEZ - agrega length?: never como trampa del typo por columnLength
//version 1.0.3 2026-08-03 SRODRIGUEZ - agrega defaultValue y defaultSql para defaults de columna
//version 1.0.2 2023-09-19 SRODRIGUEZ - agrega campos PKModuleNameId y PKModuleName para crear relación de FK en BBDD
//version 1.0.1 2023-01-04 SRODRIGUEZ
export interface IHuemulColumnDef {
    columnName: string,
    columnType: string,
    columnDescription: string,
    pkType: string,
    allowNull: boolean,
    required: boolean,
    numOrderInGet: number,
    columnPosition: number,
    columnSubType?: IHuemulColumnDef[],
    columnLength?: number,
    columnPrecision?: number,
    PKModuleNameId?: string,
    PKModuleName?: string,
    versionRelease?: string,
    /** Valor literal por defecto de la columna. Se escapa y se emite como literal SQL. `undefined` (o `null` en metadata dinámica) = sin default declarado. */
    defaultValue?: string | number | boolean,
    /** Expresión SQL por defecto, ej. "now()", "gen_random_uuid()". Se emite SIN escapar (confianza equivalente a `tableName`). Excluyente con `defaultValue`. */
    defaultSql?: string,
    /**
     * Trampa de compilación: el campo correcto es `columnLength`. Un `length: 255` se descartaba en
     * silencio y la columna terminaba con el largo por defecto. Declararlo como `never` convierte
     * ese typo en un error de compilación que apunta al campo correcto.
     */
    length?: never,
}

