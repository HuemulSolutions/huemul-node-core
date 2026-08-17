import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consoleLogger, resetConsoleLogger } from "../../src/logging/huemul-console-logger";
import { HuemulConfig } from "../../src/config/huemul-config";
import { CloudProviderType } from "../../src/types/huemul-types";

/**
 * Logger de consola por defecto.
 *
 * Lo que se protege acá es el comportamiento que motivó su existencia: que el motivo del error
 * llegue a la consola (antes solo salía el transactionId) y que el cierre exitoso de cada HuemulLog
 * no imprima nada, para no enterrar los errores.
 */
describe("consoleLogger", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetConsoleLogger();
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetConsoleLogger();
  });

  /** Junta todo lo escrito por un spy en un solo texto, para buscar dentro. */
  function output(spy: ReturnType<typeof vi.spyOn>): string {
    return spy.mock.calls.map((call) => call.join(" ")).join("\n");
  }

  it("expone los cuatro métodos que consume HuemulLog", () => {
    const logger = consoleLogger();

    for (const method of ["info", "debug", "warn", "error"]) {
      expect(typeof (logger as any)[method], `falta ${method}`).toBe("function");
    }
  });

  it("es singleton", () => {
    expect(consoleLogger()).toBe(consoleLogger());
  });

  it("no imprime el cierre exitoso de un HuemulLog", () => {
    consoleLogger().info("algo salió bien", {huemulObject: {transactionId: "abc", result: "success"}});

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("sí imprime los mensajes explícitos de consoleLog, que no traen huemulObject", () => {
    consoleLogger().info("mensaje escrito a propósito");

    expect(output(logSpy)).toContain("mensaje escrito a propósito");
  });

  it("ante un error imprime el motivo, no solo el transactionId", () => {
    consoleLogger().error("falló algo", {
      huemulObject: {
        transactionId: "abc-123",
        stepName: "endVerifyToken",
        errorId: 2040,
        errorTxt: "Unauthorized",
        orgId: "TESTORG",
        elapsedTimeMS: 3,
      },
    });

    const text = output(errorSpy);
    expect(text).toContain("stepName: endVerifyToken");
    expect(text).toContain("errorTxt: Unauthorized");
    expect(text).toContain("orgId: TESTORG");
  });

  it("imprime extraInfo, que es donde queda la causa concreta", () => {
    consoleLogger().error("401", {
      huemulObject: {
        errorTxt: "Unauthorized",
        extraInfo: {unauthorizedReason: "falta el header 'authorization'"},
      },
    });

    expect(output(errorSpy)).toContain("falta el header 'authorization'");
  });

  it("omite los campos vacíos y el relleno 'n/a' del framework", () => {
    consoleLogger().error("error", {
      huemulObject: {errorTxt: "boom", userEmail: "n/a", url: "", extraInfo: {}},
    });

    const text = output(errorSpy);
    expect(text).toContain("errorTxt: boom");
    expect(text).not.toContain("userEmail");
    expect(text).not.toContain("url:");
    expect(text).not.toContain("extraInfo");
  });

  it("incluye infoError cuando HuemulLog lo adjunta", () => {
    consoleLogger().error("error", {infoError: "JsonWebTokenError: jwt malformed"});

    expect(output(errorSpy)).toContain("jwt malformed");
  });

  it("no revienta con un huemulObject con referencias circulares", () => {
    const circular: Record<string, unknown> = {errorTxt: "boom"};
    circular.extraInfo = circular;

    expect(() => consoleLogger().error("error", {huemulObject: circular})).not.toThrow();
  });

  it("warn imprime el detalle igual que error", () => {
    consoleLogger().warn("ojo", {huemulObject: {errorTxt: "algo raro"}});

    expect(output(warnSpy)).toContain("errorTxt: algo raro");
  });
});

describe("HuemulConfig.logger", () => {
  afterEach(() => {
    resetConsoleLogger();
  });

  it("usa el logger de consola cuando configure() no recibe uno", () => {
    HuemulConfig.configure({
      appName: "test",
      cloudProvider: CloudProviderType.azure,
      appVersions: [],
    });

    expect(HuemulConfig.logger).toBeDefined();
    expect(typeof HuemulConfig.logger.error).toBe("function");
  });

  it("respeta el logger que le pasen", () => {
    const custom = {info: () => {}, debug: () => {}, warn: () => {}, error: () => {}};

    HuemulConfig.configure({
      appName: "test",
      cloudProvider: CloudProviderType.azure,
      appVersions: [],
      logger: custom,
    });

    expect(HuemulConfig.logger).toBe(custom);
  });
});
