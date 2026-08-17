/* eslint max-len: ["error", { "code": 300 }] */

/**
 * Logger de consola legible, usado por defecto cuando la app no configura uno propio.
 *
 * `HuemulConfig.logger` es un objeto del que HuemulLog solo usa `.info() / .debug() / .warn() /
 * .error()`, siempre con la forma `(message, meta)`. Antes, si la app no pasaba logger, el campo
 * quedaba en `undefined` y `consoleSavetoLogging` caía a `console.log(data.transactionId)`: un UUID
 * suelto, sin el motivo del error. Un 401 o un fallo de base no dejaban ningún rastro utilizable.
 *
 * La otra opción disponible —un winston con transport de consola— vuelca cada evento como una línea
 * JSON, incluida una por cada operación exitosa: tiene la información, pero es ilegible en terminal
 * y multiplica el volumen. Este logger es el punto medio:
 *
 *  - el cierre exitoso de cada HuemulLog no se imprime (no aporta y entierra lo que sí importa);
 *  - los mensajes explícitos de `consoleLog()` sí pasan, porque alguien los escribió a propósito;
 *  - ante un error se imprimen los campos que sirven para diagnosticar, uno por línea, y sobre todo
 *    `extraInfo`, que es donde el framework deja el mensaje crudo cuando al cliente se le responde
 *    uno genérico (ver finishErrorForDataLayer) y donde las apps dejan la causa concreta de cada
 *    rechazo.
 */

/** Meta que HuemulLog adjunta a cada llamada al logger. */
export interface IHuemulLoggerMeta {
  huemulObject?: Record<string, unknown>;
  labels?: Record<string, unknown>;
  infoError?: unknown;
  infoLog?: unknown;
}

/** Interfaz mínima que HuemulLog consume de HuemulConfig.logger. */
export interface IHuemulLogger {
  info(message: string, meta?: IHuemulLoggerMeta): void;
  debug(message: string, meta?: IHuemulLoggerMeta): void;
  warn(message: string, meta?: IHuemulLoggerMeta): void;
  error(message: string, meta?: IHuemulLoggerMeta): void;
}

/** Campos del huemulObject que vale la pena mostrar ante un error, en orden de utilidad. */
const errorFields = [
  "stepName",
  "errorId",
  "errorTxt",
  "userEmail",
  "userId",
  "orgId",
  "httpMethod",
  "url",
  "clientVersion",
  "elapsedTimeMS",
];

/**
 * Indica si el valor aporta algo o es el relleno que pone el framework cuando no hay dato.
 * @param {unknown} value valor a evaluar
 * @return {boolean} true si conviene imprimirlo
 */
function hasContent(value: unknown): boolean {
  if (value === undefined || value === null || value === "" || value === "n/a") {
    return false;
  }
  if (typeof value === "object" && Object.keys(value as object).length === 0) {
    return false;
  }

  return true;
}

/**
 * Formatea un valor para una línea de consola. Los objetos van en JSON de una línea porque acá
 * caben pocos campos y el multilínea rompe el grep.
 * @param {unknown} value valor a formatear
 * @return {string} texto listo para imprimir
 */
function format(value: unknown): string {
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Imprime los campos útiles del huemulObject, uno por línea, saltando los vacíos.
 * @param {IHuemulLoggerMeta | undefined} meta meta que entregó HuemulLog
 * @param {(message: string) => void} write console.warn o console.error
 * @return {void}
 */
function printDetail(meta: IHuemulLoggerMeta | undefined, write: (message: string) => void): void {
  const data = meta?.huemulObject;
  if (data === undefined) {
    return;
  }

  for (const field of errorFields) {
    if (hasContent(data[field])) {
      write(`[huemul]        ${field}: ${format(data[field])}`);
    }
  }

  // extraInfo va al final y siempre que tenga algo: es donde queda el motivo real, tanto el que
  // guarda el framework como el que agregan las apps en sus middlewares.
  if (hasContent(data.extraInfo)) {
    write(`[huemul]        extraInfo: ${format(data.extraInfo)}`);
  }
}

let instance: IHuemulLogger | undefined = undefined;

/**
 * Devuelve el logger de consola (singleton, igual que los loggers de nube de huemul-node-connections).
 * @return {IHuemulLogger} logger listo para pasar a HuemulConfig.configure
 */
export function consoleLogger(): IHuemulLogger {
  if (instance === undefined) {
    instance = {
      info(message: string, meta?: IHuemulLoggerMeta): void {
        if (meta?.huemulObject !== undefined) {
          return;
        }
        console.log(`[huemul] ${message}`);
      },

      debug(message: string): void {
        console.debug(`[huemul] debug ${message}`);
      },

      warn(message: string, meta?: IHuemulLoggerMeta): void {
        console.warn(`[huemul] warn ${message}`);
        printDetail(meta, console.warn);
      },

      error(message: string, meta?: IHuemulLoggerMeta): void {
        console.error(`[huemul] ERROR ${message}`);
        printDetail(meta, console.error);
        if (hasContent(meta?.infoError)) {
          console.error(`[huemul]        infoError: ${format(meta?.infoError)}`);
        }
      },
    };
  }

  return instance;
}

/**
 * Descarta el singleton. Solo para tests, que necesitan reconstruirlo tras espiar la consola.
 * @return {void}
 */
export function resetConsoleLogger(): void {
  instance = undefined;
}
