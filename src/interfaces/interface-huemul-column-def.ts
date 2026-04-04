/* eslint max-len: ["error", { "code": 400 }] */
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
}

