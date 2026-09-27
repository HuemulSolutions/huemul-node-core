import { describe, expect, it } from "vitest";
import { HuemulLog, errorType, httpStatusOfError, layerType } from "../../src/logging/huemul-log";

/**
 * Codigo HTTP de cada tipo de error. Lo que se protege: que un error de los datos o del permiso de
 * quien llama no llegue como 500, que es lo que el cliente lee como "se cayo el servidor".
 */
describe("httpStatusOfError", () => {
  it("errores de quien llama: 4xx", () => {
    expect(httpStatusOfError(errorType.dbRecordNotFound)).toBe(404);
    expect(httpStatusOfError(errorType.dbDataValidation)).toBe(400);
    expect(httpStatusOfError(errorType.appDataValidation)).toBe(400);
    expect(httpStatusOfError(errorType.appCantDelete)).toBe(400);
    expect(httpStatusOfError(errorType.appUnauthorized)).toBe(401);
    expect(httpStatusOfError(errorType.appForbidden)).toBe(403);
    expect(httpStatusOfError(errorType.dbDuplicated)).toBe(409);
    expect(httpStatusOfError(errorType.dbDataVersionError)).toBe(409);
  });

  it("fallas del servidor y codigos desconocidos: 500", () => {
    expect(httpStatusOfError(errorType.dbOther)).toBe(500);
    expect(httpStatusOfError(errorType.appOthers)).toBe(500);
    expect(httpStatusOfError(12345)).toBe(500);
    expect(httpStatusOfError("2050")).toBe(400);
  });

  it("getHttpStatusCodeError usa el mapa", () => {
    const log = new HuemulLog<unknown>(layerType.logic, "test", "c", "test", "1.0");
    log.finishErrorForDataLayer(errorType.appDataValidation, "falta un dato");
    expect(log.getHttpStatusCodeError()).toBe(400);
  });
});
