import { IHuemulAppVersion } from "../interfaces/interface-huemul-appversion-v1";
import { CloudProviderType } from "../types/huemul-types";
import { consoleLogger } from "../logging/huemul-console-logger";

export interface IHuemulConfig {
  appName: string;
  cloudProvider: CloudProviderType;
  appVersions: IHuemulAppVersion[];
  /**
   * Destino de los logs. Debe exponer `.info() / .debug() / .warn() / .error()` con la forma
   * `(message, meta)` — por ejemplo los loggers de nube de huemul-node-connections.
   *
   * Omitirlo usa el logger de consola del package, que imprime el motivo de cada error de forma
   * legible. Para silenciar la salida, pasa un logger con los cuatro métodos vacíos: HuemulLog
   * comprueba `!== undefined`, así que dejarlo en undefined no apaga nada, solo cambia el destino.
   */
  logger?: any;
}

/**
 * Global app configuration — call HuemulConfig.configure() once at startup.
 * All framework classes (HuemulLog, etc.) read from this singleton.
 */
export class HuemulConfig {
  static appName: string = "";
  static cloudProvider: CloudProviderType = CloudProviderType.azure;
  static appVersions: IHuemulAppVersion[] = [];
  static logger: any = consoleLogger();

  static configure(config: IHuemulConfig): void {
    HuemulConfig.appName = config.appName;
    HuemulConfig.cloudProvider = config.cloudProvider;
    HuemulConfig.appVersions = config.appVersions;
    // Sin logger explícito se usa el de consola. Antes quedaba en undefined y HuemulLog caía a
    // imprimir solo el transactionId: un UUID suelto, sin el motivo del error.
    HuemulConfig.logger = config.logger === undefined ? consoleLogger() : config.logger;
  }
}
