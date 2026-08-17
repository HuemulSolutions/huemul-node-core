/* eslint max-len: ["error", { "code": 300 }] */
import { CloudProviderType, DatabaseType, HuemulEnvironmentType, UserManagerType } from "../types/huemul-types";

/**
 * Validación de variables de entorno al arranque.
 *
 * Existe porque las apps leen casi todas sus variables con `process.env.X ?? ""`: una variable
 * ausente, vacía o con solo espacios queda indistinguible de una bien configurada, el server
 * arranca sin decir nada y el problema recién se manifiesta en request, con un error genérico.
 * `SECRET_KEY_JWT` vacío, por ejemplo, hace que huemul-node-rbac devuelva un 401 "unauthorized"
 * idéntico al de una contraseña mala.
 *
 * Por decisión de diseño esto SOLO avisa: nunca aborta el proceso, ni siquiera ante una variable
 * crítica. La idea es que un entorno a medio configurar igual levante para poder diagnosticarlo.
 *
 * Uso típico en la app, en app.ts, justo después de dotenv.config() y ANTES de importar los
 * módulos que congelan las constantes de configuración:
 *
 *   const specs = buildEnvSpecs(huemulEnvSpecsBase, misSpecsDeNegocio);
 *   printEnvCheck(specs);
 *
 * Los packages no leen process.env: reciben su configuración por inyección. Los nombres de este
 * catálogo son la convención de los proyectos Huemul, no un contrato del package, y por eso
 * buildEnvSpecs permite renombrar, reseverizar o excluir cualquier entrada.
 */

/** Qué tan grave es que la variable falte. */
export type HuemulEnvSeverity = "critical" | "recommended" | "optional";

/** Descripción de una variable de entorno que la app lee. */
export interface IHuemulEnvSpec {
  /** nombre tal cual aparece en process.env */
  name: string;
  /** severidad si falta */
  severity: HuemulEnvSeverity;
  /** grupo para agrupar la salida; texto libre para que cada app agregue los suyos */
  group: string;
  /** para qué se usa; sale en el mensaje */
  usedFor: string;
  /** qué valor se termina usando si falta */
  defaultValue?: string;
  /** si está presente, el valor debe ser uno de estos */
  allowedValues?: string[];
  /** validación libre: devuelve el texto del problema, o undefined si el valor está bien */
  validate?: (value: string) => string | undefined;
}

/** Variable que falta (ausente, vacía o solo espacios). */
export interface IHuemulEnvMissing {
  name: string;
  severity: HuemulEnvSeverity;
  group: string;
  usedFor: string;
  defaultValue?: string;
}

/** Variable presente pero con un valor que el código no va a poder usar. */
export interface IHuemulEnvInvalid {
  name: string;
  group: string;
  /** qué está mal, en texto */
  problem: string;
}

/** Resultado del chequeo. */
export interface IHuemulEnvCheckResult {
  missing: IHuemulEnvMissing[];
  invalid: IHuemulEnvInvalid[];
  /** true si no falta nada ni hay valores inválidos */
  isOK: boolean;
  /** true si falta al menos una variable crítica */
  hasCritical: boolean;
}

/**
 * Lee una variable de entorno numérica con valor por defecto.
 *
 * Existe porque `Number(process.env.X) ?? 50` NO funciona: si la variable no está definida,
 * `Number(undefined)` devuelve `NaN`, que no es null ni undefined, así que `??` nunca entrega el
 * default y la constante queda en `NaN`. Lo mismo si la variable trae texto no numérico.
 *
 * A diferencia de `Number(...) || default`, respeta el cero: `numberFromEnv("0", 4)` devuelve 0.
 * @param {string | undefined} value valor crudo de process.env
 * @param {number} defaultValue valor a usar si falta o no es numérico
 * @return {number} el número leído, o el default
 */
export function numberFromEnv(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Valida el formato `host:puerto` que usan las direcciones de base de datos.
 *
 * huemul-node-connections hace `direccion.split(":")` y `Number(parte[1])`, así que una dirección
 * sin puerto deja la conexión con `port: NaN` y falla sin un mensaje que apunte a la causa.
 * @param {string} value valor a validar
 * @return {string | undefined} texto del problema, o undefined si está bien
 */
export function validateHostPort(value: string): string | undefined {
  const parts = value.split(":");
  if (parts.length !== 2 || parts[0] === "" || !Number.isFinite(Number(parts[1]))) {
    return `se espera formato host:puerto (ej: 127.0.0.1:5432), llegó "${value}"`;
  }

  return undefined;
}

// =====================================================================
//  CATÁLOGO BASE
//  Variables que alimentan la configuración de los packages Huemul. Cada app las combina con las
//  suyas usando buildEnvSpecs().
// =====================================================================

/** Bases de datos: HuemulConnectionsConfig.database. */
export const huemulEnvSpecsDatabase: IHuemulEnvSpec[] = [
  {name: "ADMIN_SERVER_ADDRESS", severity: "critical", group: "Base de datos", usedFor: "host:puerto de la base ADMIN (usuarios, sesiones, orgs)", validate: validateHostPort},
  {name: "ADMIN_DB_USER", severity: "critical", group: "Base de datos", usedFor: "usuario de la base ADMIN"},
  {name: "ADMIN_DB_PASS", severity: "critical", group: "Base de datos", usedFor: "password de la base ADMIN"},
  {name: "ADMIN_DB_NAME", severity: "critical", group: "Base de datos", usedFor: "nombre de la base ADMIN"},
  {name: "APP_SERVER_ADDRESS", severity: "critical", group: "Base de datos", usedFor: "host:puerto de la base de negocio", validate: validateHostPort},
  {name: "APP_DB_USER", severity: "critical", group: "Base de datos", usedFor: "usuario de la base de negocio"},
  {name: "APP_DB_PASS", severity: "critical", group: "Base de datos", usedFor: "password de la base de negocio"},
  {name: "APP_DB_NAME", severity: "critical", group: "Base de datos", usedFor: "nombre de la base de negocio"},
  {name: "DATABASE_TYPE", severity: "critical", group: "Base de datos", usedFor: "motor de base de datos", allowedValues: Object.values(DatabaseType)},
];

/** Autenticación y RBAC: HuemulRbacConfig. */
export const huemulEnvSpecsRbac: IHuemulEnvSpec[] = [
  {name: "SECRET_KEY_JWT", severity: "critical", group: "Login y llaves", usedFor: "firma y verificación del JWT de sesión; vacía hace fallar TODO login con un 401 genérico"},
  {name: "SECRET_KEY_JWT_SERVICE_ACCOUNT", severity: "optional", group: "Login y llaves", usedFor: "verificación de tokens de service accounts", defaultValue: "vacía (sin service accounts)"},
  {name: "LOGIN_EXPIRATION_TIME", severity: "recommended", group: "Login y llaves", usedFor: "vigencia del JWT de sesión", defaultValue: "10h"},
  {name: "SECRET_KEY_PASSWORD", severity: "recommended", group: "Login y llaves", usedFor: "rounds de bcrypt al crear passwords", defaultValue: "15"},
  {name: "URL_LOGIN_APP_CALLBACK", severity: "recommended", group: "Login y llaves", usedFor: "callback al que vuelve el front tras autenticarse", defaultValue: "vacía"},
  {name: "SECRET_KEY_TOKENS", severity: "optional", group: "Login y llaves", usedFor: "cifrado de tokens externos guardados en sesión", defaultValue: "vacía"},
  {name: "SECRET_KEY_SAML2", severity: "optional", group: "Login y llaves", usedFor: "firma SAML2", defaultValue: "vacía (SAML2 deshabilitado)"},
  {name: "URL_SAML2_CALLBACK", severity: "optional", group: "Login y llaves", usedFor: "callback de SAML2", defaultValue: "vacía"},
  {name: "URL_SAML2_INIT", severity: "optional", group: "Login y llaves", usedFor: "URL de inicio de SAML2", defaultValue: "vacía"},
  {name: "SAML2_APP_ID", severity: "optional", group: "Login y llaves", usedFor: "application id de SAML2", defaultValue: "vacía"},
  {name: "USER_MANAGER_TYPE", severity: "optional", group: "Login y llaves", usedFor: "gestor de usuarios", defaultValue: "vacía", allowedValues: Object.values(UserManagerType)},
];

/** Entorno de ejecución del backend. */
export const huemulEnvSpecsApp: IHuemulEnvSpec[] = [
  {name: "CORS_ORIGIN_LIST", severity: "critical", group: "Entorno", usedFor: "orígenes permitidos, separados por coma; vacía rechaza TODAS las llamadas del front"},
  {name: "CLOUD_PROVIDER", severity: "recommended", group: "Entorno", usedFor: "proveedor de nube; define el logger", defaultValue: "sin definir (se usa el logger de consola)", allowedValues: Object.values(CloudProviderType)},
  {name: "ENVIROMENT", severity: "recommended", group: "Entorno", usedFor: "entorno de ejecución (ojo: el nombre va sin la N)", defaultValue: "sin definir", allowedValues: Object.values(HuemulEnvironmentType)},
  {name: "URL_BACKEND", severity: "recommended", group: "Entorno", usedFor: "URL pública de este backend", defaultValue: "vacía"},
  {name: "URL_WEB", severity: "optional", group: "Entorno", usedFor: "URL del front", defaultValue: "vacía"},
  {name: "PORT", severity: "optional", group: "Entorno", usedFor: "puerto HTTP", defaultValue: "el que fije la app"},
  {name: "JSON_LIMIT", severity: "optional", group: "Entorno", usedFor: "tamaño máximo del body JSON", defaultValue: "10mb"},
  {name: "ROWS_FOR_GETS", severity: "optional", group: "Entorno", usedFor: "filas por página por defecto", defaultValue: "50"},
  {name: "MAX_ROWS_FOR_GETS", severity: "optional", group: "Entorno", usedFor: "tope de filas por página", defaultValue: "1000"},
  {name: "RATE_LIMIT_MINUTE", severity: "optional", group: "Entorno", usedFor: "ventana del rate limit, en minutos", defaultValue: "5"},
  {name: "RATE_LIMIT_MAX_REQUEST", severity: "optional", group: "Entorno", usedFor: "requests permitidos por ventana e IP", defaultValue: "300"},
  {name: "RUN_INTERNAL_TASK", severity: "optional", group: "Entorno", usedFor: "habilita el scheduler y los cron en esta réplica", defaultValue: "false"},
  {name: "TASK_WORKER_POOL_SIZE", severity: "optional", group: "Entorno", usedFor: "workers concurrentes de la cola de tareas por réplica", defaultValue: "el que fije la app"},
];

/** Envío de correo: HuemulConnectionsConfig.mail. */
export const huemulEnvSpecsEmail: IHuemulEnvSpec[] = [
  // EmailProviderType vive en huemul-node-connections; core no puede importarlo sin invertir la
  // dependencia, así que los valores van literales. Mantener alineado si el enum cambia.
  {name: "EMAIL_PROVIDER", severity: "recommended", group: "Email", usedFor: "proveedor de correo", defaultValue: "vacía (no se envían correos)", allowedValues: ["google", "azure"]},
  {name: "EMAIL_SENDER", severity: "recommended", group: "Email", usedFor: "dirección remitente", defaultValue: "vacía"},
  {name: "EMAIL_AZURE_APPLICATION_ID", severity: "optional", group: "Email", usedFor: "app registration para enviar correo por Azure", defaultValue: "vacía"},
  {name: "EMAIL_AZURE_SECRET", severity: "optional", group: "Email", usedFor: "secret del app registration de Azure", defaultValue: "vacía"},
  {name: "EMAIL_AZURE_TENANT_ID", severity: "optional", group: "Email", usedFor: "tenant del app registration de Azure", defaultValue: "vacía"},
  {name: "EMAIL_GOOGLE_SERVICE_CLIENT", severity: "optional", group: "Email", usedFor: "service account para enviar correo por Google", defaultValue: "vacía"},
  {name: "EMAIL_GOOGLE_PRIVATE_KEY", severity: "optional", group: "Email", usedFor: "private key de la service account de Google", defaultValue: "vacía"},
];

/** Storage público (Azure Blob / GCP Storage). */
export const huemulEnvSpecsStorage: IHuemulEnvSpec[] = [
  {name: "STORAGE_URL_BASE_GENERAL", severity: "optional", group: "Storage", usedFor: "URL base del storage público", defaultValue: "vacía"},
  {name: "STORAGE_CONTAINER_NAME_GENERAL", severity: "optional", group: "Storage", usedFor: "container del storage público", defaultValue: "vacía"},
  {name: "STORAGE_NAME_GENERAL", severity: "optional", group: "Storage", usedFor: "cuenta del storage público", defaultValue: "vacía"},
  {name: "STORAGE_KEY_GENERAL", severity: "optional", group: "Storage", usedFor: "key del storage público", defaultValue: "vacía"},
];

/** Key Vault de Azure: HuemulConnectionsConfig.keyVault. */
export const huemulEnvSpecsKeyVault: IHuemulEnvSpec[] = [
  {name: "KEY_VAULT_AZURE_CLIENT_ID", severity: "optional", group: "Key Vault", usedFor: "app registration del Key Vault", defaultValue: "vacía"},
  {name: "KEY_VAULT_AZURE_CLIENT_SECRET", severity: "optional", group: "Key Vault", usedFor: "secret del app registration del Key Vault", defaultValue: "vacía"},
  {name: "KEY_VAULT_AZURE_TENANT_ID", severity: "optional", group: "Key Vault", usedFor: "tenant del Key Vault", defaultValue: "vacía"},
  {name: "KEY_VAULT_AZURE_URI", severity: "optional", group: "Key Vault", usedFor: "URI del Key Vault", defaultValue: "vacía"},
];

/** Catálogo base completo: todos los grupos anteriores. */
export const huemulEnvSpecsBase: IHuemulEnvSpec[] = [
  ...huemulEnvSpecsDatabase,
  ...huemulEnvSpecsRbac,
  ...huemulEnvSpecsApp,
  ...huemulEnvSpecsEmail,
  ...huemulEnvSpecsStorage,
  ...huemulEnvSpecsKeyVault,
];

/**
 * Combina el catálogo base con el de la app.
 *
 * Los nombres del catálogo base son la convención Huemul, no un contrato: un proyecto puede usar
 * otro nombre para la misma variable (por ejemplo STORAGE_URL_BASE_GENERAL_INV) o considerar
 * crítica una que acá es opcional. Por eso:
 *
 *  - una spec de `custom` con el mismo `name` que una del base la REEMPLAZA, en su misma posición;
 *  - una spec de `custom` con nombre nuevo se AGREGA al final;
 *  - los nombres listados en `exclude` se quitan del base (útil al renombrar una variable).
 * @param {IHuemulEnvSpec[]} base catálogo base, normalmente huemulEnvSpecsBase o un subconjunto
 * @param {IHuemulEnvSpec[]} custom specs propias de la app
 * @param {string[]} exclude nombres del base que no aplican a esta app
 * @return {IHuemulEnvSpec[]} catálogo final, sin duplicados
 */
export function buildEnvSpecs(base: IHuemulEnvSpec[], custom: IHuemulEnvSpec[] = [], exclude: string[] = []): IHuemulEnvSpec[] {
  const excluded = new Set(exclude);
  const overrides = new Map(custom.map((spec) => [spec.name, spec]));
  const used = new Set<string>();

  const result: IHuemulEnvSpec[] = [];

  for (const spec of base) {
    if (excluded.has(spec.name)) {
      continue;
    }

    const override = overrides.get(spec.name);
    if (override !== undefined) {
      result.push(override);
      used.add(spec.name);
      continue;
    }

    result.push(spec);
  }

  for (const spec of custom) {
    if (!used.has(spec.name)) {
      result.push(spec);
    }
  }

  return result;
}

/**
 * Una variable cuenta como ausente si no está definida, está vacía o trae solo espacios.
 *
 * El chequeo por `undefined` a secas no alcanza: el patrón `process.env.X ?? ""` hace que
 * `SECRET_KEY_JWT=` (definida pero vacía) se comporte exactamente igual que si no existiera.
 * @param {string | undefined} value valor crudo de process.env
 * @return {boolean} true si hay que avisar
 */
function isMissingValue(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

/**
 * Revisa el entorno contra el catálogo y devuelve lo que falta y lo que está mal escrito.
 *
 * No imprime nada ni aborta: solo informa. La impresión la hace printEnvCheck().
 * @param {IHuemulEnvSpec[]} specs catálogo a validar
 * @param {NodeJS.ProcessEnv} env entorno a revisar; por defecto process.env
 * @return {IHuemulEnvCheckResult} variables faltantes e inválidas
 */
export function checkEnv(specs: IHuemulEnvSpec[], env: NodeJS.ProcessEnv = process.env): IHuemulEnvCheckResult {
  const missing: IHuemulEnvMissing[] = [];
  const invalid: IHuemulEnvInvalid[] = [];

  for (const spec of specs) {
    const rawValue = env[spec.name];

    if (isMissingValue(rawValue)) {
      missing.push({
        name: spec.name,
        severity: spec.severity,
        group: spec.group,
        usedFor: spec.usedFor,
        defaultValue: spec.defaultValue,
      });
      continue;
    }

    // A partir de acá la variable tiene valor: se revisa que además sea usable.
    const value = (rawValue as string).trim();

    if (spec.allowedValues !== undefined && !spec.allowedValues.includes(value)) {
      invalid.push({
        name: spec.name,
        group: spec.group,
        problem: `valor "${value}" no reconocido; se espera uno de: ${spec.allowedValues.join(" | ")}`,
      });
    }

    if (spec.validate !== undefined) {
      const problem = spec.validate(value);
      if (problem !== undefined) {
        invalid.push({name: spec.name, group: spec.group, problem});
      }
    }
  }

  const hasCritical = missing.some((item) => item.severity === "critical");

  return {
    missing,
    invalid,
    isOK: missing.length === 0 && invalid.length === 0,
    hasCritical,
  };
}

/** Etiqueta legible por severidad. */
const severityLabel: Record<HuemulEnvSeverity, string> = {
  critical: "CRITICA",
  recommended: "RECOMENDADA",
  optional: "opcional",
};

/** Orden de impresión: primero lo que más duele. */
const severityOrder: HuemulEnvSeverity[] = ["critical", "recommended", "optional"];

/**
 * Corre checkEnv() e imprime el resultado por consola.
 *
 * Nunca aborta el proceso, ni siquiera ante variables críticas: es una decisión explícita para que
 * un entorno mal configurado igual levante y se pueda diagnosticar.
 * @param {IHuemulEnvSpec[]} specs catálogo a validar
 * @param {NodeJS.ProcessEnv} env entorno a revisar; por defecto process.env
 * @return {IHuemulEnvCheckResult} el mismo resultado de checkEnv, por si el llamador quiere inspeccionarlo
 */
export function printEnvCheck(specs: IHuemulEnvSpec[], env: NodeJS.ProcessEnv = process.env): IHuemulEnvCheckResult {
  const result = checkEnv(specs, env);

  if (result.isOK) {
    console.log(`[env-check] OK: las ${specs.length} variables de entorno conocidas tienen valor.`);
    return result;
  }

  console.warn("[env-check] ==========================================================");
  console.warn("[env-check] Revisión de variables de entorno");

  for (const severity of severityOrder) {
    const items = result.missing.filter((item) => item.severity === severity);
    if (items.length === 0) {
      continue;
    }

    // Las opcionales se resumen en una línea: en un entorno normal hay ~20 sin usar (SAML2, storage,
    // Key Vault...) y detallarlas cada vez entierra a las que sí importan.
    if (severity === "optional") {
      console.warn(`[env-check] --- ${severityLabel[severity]} (${items.length}), sin efecto si no usas esas funcionalidades ---`);
      console.warn(`[env-check]   ${items.map((item) => item.name).join(", ")}`);
      continue;
    }

    console.warn(`[env-check] --- ${severityLabel[severity]} (${items.length}) ---`);
    for (const item of items) {
      const fallback = item.defaultValue === undefined ?
        "sin valor por defecto" :
        `se usará: ${item.defaultValue}`;
      console.warn(`[env-check]   FALTA ${item.name} [${item.group}] -> ${item.usedFor} (${fallback})`);
    }
  }

  if (result.invalid.length > 0) {
    console.warn(`[env-check] --- VALORES INVALIDOS (${result.invalid.length}) ---`);
    for (const item of result.invalid) {
      console.warn(`[env-check]   ${item.name} [${item.group}] -> ${item.problem}`);
    }
  }

  if (result.hasCritical) {
    console.warn("[env-check] Hay variables CRITICAS sin valor: el server arranca igual, pero es muy probable que falle en request.");
  }
  console.warn("[env-check] ==========================================================");

  return result;
}
