/* eslint max-len: ["error", { "code": 400 }] */
//version 1.0.1 2023-01-04 SRODRIGUEZ
import {IHuemulColumnDef} from "./interface-huemul-column-def";

export interface IHuemulBase {
    cdcState?: number,
    cdcCreateDt?: string,
    cdcCreateUser?: string,
    cdcCreateApiVersion?: string,
    cdcUpdateDt?: string | Date,
    cdcUpdateUser?: string,
    cdcUpdateApiVersion?: string,
    errorSinc?: boolean,
    internalTaskKey?: string,
    versionKey?: string,

}

export const huemulBaseColumnsInfo: IHuemulColumnDef[] = [
  {columnName: "cdcState", columnType: "number", columnDescription: "record status (1: active, -1: inactive)", pkType: "none", allowNull: true, required: true, numOrderInGet: 0, columnPosition: 0},
  {columnName: "cdcCreateDt", columnType: "TimeStamp", columnDescription: "create timestamp", pkType: "none", allowNull: true, required: true, numOrderInGet: 1, columnPosition: 1},
  {columnName: "cdcCreateUser", columnType: "string", columnDescription: "user creation", pkType: "none", allowNull: true, required: true, numOrderInGet: 0, columnPosition: 2},
  {columnName: "cdcCreateApiVersion", columnType: "string", columnDescription: "api version", pkType: "none", allowNull: true, required: true, numOrderInGet: 0, columnPosition: 3},
  {columnName: "cdcUpdateDt", columnType: "TimeStamp", columnDescription: "update timestamp", pkType: "none", allowNull: true, required: true, numOrderInGet: 0, columnPosition: 4},
  {columnName: "cdcUpdateUser", columnType: "string", columnDescription: "user update", pkType: "none", allowNull: true, required: true, numOrderInGet: 0, columnPosition: 5},
  {columnName: "cdcUpdateApiVersion", columnType: "string", columnDescription: "api version", pkType: "none", allowNull: true, required: true, numOrderInGet: 0, columnPosition: 6},
  {columnName: "errorSinc", columnType: "boolean", columnDescription: "true for error in syc with DW", pkType: "none", allowNull: true, required: true, numOrderInGet: 0, columnPosition: 7},
  {columnName: "internalTaskKey", columnType: "string", columnLength: 200, columnDescription: "field used for internalTask batch updated", pkType: "none", allowNull: true, required: true, numOrderInGet: 0, columnPosition: 8},
  {columnName: "versionKey", columnType: "string", columnLength: 200, columnDescription: "version control", pkType: "none", allowNull: true, required: true, numOrderInGet: 0, columnPosition: 9},

];
