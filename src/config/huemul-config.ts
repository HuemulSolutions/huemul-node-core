import { IHuemulAppVersion } from "../interfaces/interface-huemul-appversion-v1";
import { CloudProviderType } from "../types/huemul-types";

export interface IHuemulConfig {
  appName: string;
  cloudProvider: CloudProviderType;
  appVersions: IHuemulAppVersion[];
  logger: any;
}

/**
 * Global app configuration — call HuemulConfig.configure() once at startup.
 * All framework classes (HuemulLog, etc.) read from this singleton.
 */
export class HuemulConfig {
  static appName: string = "";
  static cloudProvider: CloudProviderType = CloudProviderType.azure;
  static appVersions: IHuemulAppVersion[] = [];
  static logger: any;

  static configure(config: IHuemulConfig): void {
    HuemulConfig.appName = config.appName;
    HuemulConfig.cloudProvider = config.cloudProvider;
    HuemulConfig.appVersions = config.appVersions;
    HuemulConfig.logger = config.logger;
  }
}
