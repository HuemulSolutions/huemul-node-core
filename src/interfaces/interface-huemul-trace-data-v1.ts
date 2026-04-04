/* eslint max-len: ["error", { "code": 400 }] */
//version 1.0.1 2023-01-04 SRODRIGUEZ
import {IHuemulBase} from "./interface-huemul-base-data-v1";

/**
 * huemulTrace interface
 * @description: detailed log, get services executions and lineage
 * @author Sebastián Rodríguez Robotham
 */
export interface IHuemulTrace extends IHuemulBase {
    transactionId: string,
    transactionIdOrigin: string,

    orgId: string,
    app: string,
    module: string,
    layer: string,
    action: string,
    functionName: string,

    stepName: string,
    userId?: string,
    userEmail?: string,
    internalTaskId?: string,

    url: string,
    httpMethod: string,
    ip: string,
    // operation?: string,

    clientLanguage: string,
    clientVersion: string,
    clientApp: string,
    clientInfo: string

    // platformInfo: string
    numRecordsRead: number,
    numRecordsWrite: number,
    numRecordsUpdate: number,
    numRecordsDelete: number,

    bodySize: number,

    startDate: string,
    endDate?: string,
    elapsedTimeMS: number,

    startDateIsAuth?: string,
    endDateIsAuth?: string,
    elapsedTimeIsAuthMS?: number,

    result?: string,
    errorId: string,
    errorTxt: string,
    extraInfo?: string,

    numSubProcess: number,
    numSubProcessLevel1: number,
}
