import { describe, expect, it } from "vitest";
import {
  buildEnvSpecs,
  checkEnv,
  huemulEnvSpecsBase,
  huemulEnvSpecsDatabase,
  huemulEnvSpecsEmail,
  IHuemulEnvSpec,
  numberFromEnv,
  validateHostPort,
} from "../../src/config/huemul-env-check";
import { CloudProviderType, DatabaseType, HuemulEnvironmentType, UserManagerType } from "../../src/types/huemul-types";

/**
 * Validación de variables de entorno al arranque.
 *
 * El caso que motiva el módulo es el de la variable definida pero vacía: las apps leen todo con
 * `?? ""`, así que `SECRET_KEY_JWT=` se comporta igual que no tenerla, pero un chequeo por
 * `undefined` a secas la daría por buena.
 */

/** Entorno con todas las variables del catálogo dado seteadas a un valor válido. */
function fullEnv(specs: IHuemulEnvSpec[] = huemulEnvSpecsBase): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const spec of specs) {
    // si la spec restringe valores, se usa el primero permitido; si valida formato, host:puerto
    env[spec.name] = spec.allowedValues !== undefined ? spec.allowedValues[0] :
      spec.validate !== undefined ? "127.0.0.1:5432" :
      "valor";
  }

  return env;
}

describe("numberFromEnv", () => {
  it("usa el default cuando falta, está vacía o no es numérica", () => {
    expect(numberFromEnv(undefined, 50)).toBe(50);
    expect(numberFromEnv("", 50)).toBe(50);
    expect(numberFromEnv("   ", 50)).toBe(50);
    expect(numberFromEnv("abc", 50)).toBe(50);
    expect(numberFromEnv("12abc", 50)).toBe(50);
    expect(numberFromEnv("Infinity", 50)).toBe(50);
  });

  it("lee el valor cuando es un número válido", () => {
    expect(numberFromEnv("20", 50)).toBe(20);
    expect(numberFromEnv(" 20 ", 50)).toBe(20);
    expect(numberFromEnv("1.5", 50)).toBe(1.5);
  });

  it("respeta el cero, a diferencia de Number(...) || default", () => {
    expect(numberFromEnv("0", 50)).toBe(0);
  });

  it("nunca devuelve NaN, que era el defecto del patrón Number(...) ?? default", () => {
    for (const value of [undefined, "", "abc", "NaN"]) {
      expect(Number.isNaN(numberFromEnv(value, 50))).toBe(false);
    }
  });
});

describe("validateHostPort", () => {
  it("acepta host:puerto", () => {
    expect(validateHostPort("127.0.0.1:5432")).toBeUndefined();
    expect(validateHostPort("mi-server.postgres.database.azure.com:5432")).toBeUndefined();
  });

  it("rechaza lo que dejaría la conexión con port NaN", () => {
    expect(validateHostPort("127.0.0.1")).toContain("host:puerto");
    expect(validateHostPort("127.0.0.1:puerto")).toContain("host:puerto");
    expect(validateHostPort(":5432")).toContain("host:puerto");
    expect(validateHostPort("a:b:c")).toContain("host:puerto");
  });
});

describe("checkEnv", () => {
  it("no reporta nada cuando todas las variables tienen valor válido", () => {
    const result = checkEnv(huemulEnvSpecsBase, fullEnv());

    expect(result.missing).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
    expect(result.isOK).toBe(true);
    expect(result.hasCritical).toBe(false);
  });

  it("detecta la variable ausente", () => {
    const env = fullEnv();
    delete env.SECRET_KEY_JWT;

    const result = checkEnv(huemulEnvSpecsBase, env);

    expect(result.missing.map((m) => m.name)).toEqual(["SECRET_KEY_JWT"]);
    expect(result.hasCritical).toBe(true);
    expect(result.isOK).toBe(false);
  });

  it("detecta la variable definida pero vacía, que es el caso que motiva el módulo", () => {
    const env = fullEnv();
    env.SECRET_KEY_JWT = "";

    expect(checkEnv(huemulEnvSpecsBase, env).missing.map((m) => m.name)).toEqual(["SECRET_KEY_JWT"]);
  });

  it("detecta la variable con solo espacios", () => {
    const env = fullEnv();
    env.ADMIN_DB_NAME = "   ";

    expect(checkEnv(huemulEnvSpecsBase, env).missing.map((m) => m.name)).toEqual(["ADMIN_DB_NAME"]);
  });

  it("no marca como crítica una variable opcional faltante", () => {
    const env = fullEnv();
    delete env.SAML2_APP_ID;

    const result = checkEnv(huemulEnvSpecsBase, env);

    expect(result.missing.map((m) => m.name)).toEqual(["SAML2_APP_ID"]);
    expect(result.hasCritical).toBe(false);
    expect(result.isOK).toBe(false);
  });

  it("reporta valor fuera de allowedValues", () => {
    const env = fullEnv();
    env.DATABASE_TYPE = "mysql";

    const result = checkEnv(huemulEnvSpecsBase, env);

    expect(result.missing).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].name).toBe("DATABASE_TYPE");
    expect(result.invalid[0].problem).toContain("postgres");
  });

  it("acepta todos los valores de los enums del framework", () => {
    const cases: [string, string[]][] = [
      ["DATABASE_TYPE", Object.values(DatabaseType)],
      ["USER_MANAGER_TYPE", Object.values(UserManagerType)],
      ["CLOUD_PROVIDER", Object.values(CloudProviderType)],
      ["ENVIROMENT", Object.values(HuemulEnvironmentType)],
      ["EMAIL_PROVIDER", ["google", "azure"]],
    ];

    for (const [name, values] of cases) {
      for (const value of values) {
        const env = fullEnv();
        env[name] = value;
        expect(checkEnv(huemulEnvSpecsBase, env).invalid, `${name}=${value}`).toHaveLength(0);
      }
    }
  });

  it("reporta el server address sin puerto, que dejaría la conexión con port NaN", () => {
    const env = fullEnv();
    env.ADMIN_SERVER_ADDRESS = "127.0.0.1";

    const result = checkEnv(huemulEnvSpecsBase, env);

    expect(result.invalid.map((i) => i.name)).toEqual(["ADMIN_SERVER_ADDRESS"]);
    expect(result.invalid[0].problem).toContain("host:puerto");
  });

  it("no reporta formato inválido cuando el server address falta: ya se reporta como faltante", () => {
    const env = fullEnv();
    env.APP_SERVER_ADDRESS = "";

    const result = checkEnv(huemulEnvSpecsBase, env);

    expect(result.missing.map((m) => m.name)).toEqual(["APP_SERVER_ADDRESS"]);
    expect(result.invalid).toHaveLength(0);
  });

  it("clasifica las faltantes por severidad", () => {
    const env = fullEnv();
    delete env.SECRET_KEY_JWT;
    delete env.URL_BACKEND;
    delete env.SAML2_APP_ID;

    const result = checkEnv(huemulEnvSpecsBase, env);
    const bySeverity = (severity: string) => result.missing.filter((m) => m.severity === severity).map((m) => m.name);

    expect(bySeverity("critical")).toEqual(["SECRET_KEY_JWT"]);
    expect(bySeverity("recommended")).toEqual(["URL_BACKEND"]);
    expect(bySeverity("optional")).toEqual(["SAML2_APP_ID"]);
  });

  it("valida solo el catálogo que recibe, no el base completo", () => {
    const result = checkEnv(huemulEnvSpecsDatabase, {});

    expect(result.missing).toHaveLength(huemulEnvSpecsDatabase.length);
    expect(result.missing.every((m) => m.group === "Base de datos")).toBe(true);
  });
});

describe("catálogo base", () => {
  it("no tiene nombres repetidos", () => {
    const names = huemulEnvSpecsBase.map((s) => s.name);
    expect(new Set(names).size, `duplicados en huemulEnvSpecsBase: ${names.join(", ")}`).toBe(names.length);
  });

  it("toda spec declara nombre, severidad, grupo y para qué sirve", () => {
    for (const spec of huemulEnvSpecsBase) {
      expect(spec.name, "name vacío").toBeTruthy();
      expect(["critical", "recommended", "optional"], `severidad inválida en ${spec.name}`).toContain(spec.severity);
      expect(spec.group, `group vacío en ${spec.name}`).toBeTruthy();
      expect(spec.usedFor, `usedFor vacío en ${spec.name}`).toBeTruthy();
    }
  });
});

describe("buildEnvSpecs", () => {
  const custom: IHuemulEnvSpec[] = [
    {name: "MI_API_TOKEN", severity: "critical", group: "Negocio", usedFor: "token de la API de XYZ"},
  ];

  it("agrega las specs de la app al final", () => {
    const specs = buildEnvSpecs(huemulEnvSpecsDatabase, custom);

    expect(specs).toHaveLength(huemulEnvSpecsDatabase.length + 1);
    expect(specs[specs.length - 1].name).toBe("MI_API_TOKEN");
  });

  it("reemplaza en su misma posición la spec base que comparte nombre", () => {
    const override: IHuemulEnvSpec = {name: "URL_WEB", severity: "critical", group: "Entorno", usedFor: "obligatoria en esta app"};
    const specs = buildEnvSpecs(huemulEnvSpecsBase, [override]);

    const found = specs.filter((s) => s.name === "URL_WEB");
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe("critical");
    expect(specs).toHaveLength(huemulEnvSpecsBase.length);
    expect(specs.indexOf(found[0])).toBe(huemulEnvSpecsBase.findIndex((s) => s.name === "URL_WEB"));
  });

  it("excluye del base los nombres indicados, para poder renombrar una variable", () => {
    const specs = buildEnvSpecs(
      huemulEnvSpecsBase,
      [{name: "STORAGE_URL_BASE_GENERAL_INV", severity: "optional", group: "Storage", usedFor: "URL base del storage"}],
      ["STORAGE_URL_BASE_GENERAL"],
    );

    expect(specs.some((s) => s.name === "STORAGE_URL_BASE_GENERAL")).toBe(false);
    expect(specs.some((s) => s.name === "STORAGE_URL_BASE_GENERAL_INV")).toBe(true);
    expect(specs).toHaveLength(huemulEnvSpecsBase.length);
  });

  it("permite quitar un grupo entero que la app no usa", () => {
    const specs = buildEnvSpecs(huemulEnvSpecsBase, [], huemulEnvSpecsEmail.map((s) => s.name));

    expect(specs.some((s) => s.group === "Email")).toBe(false);
    expect(specs).toHaveLength(huemulEnvSpecsBase.length - huemulEnvSpecsEmail.length);
  });

  it("nunca produce nombres duplicados", () => {
    const specs = buildEnvSpecs(huemulEnvSpecsBase, [
      ...custom,
      {name: "DATABASE_TYPE", severity: "critical", group: "Base de datos", usedFor: "override"},
    ]);
    const names = specs.map((s) => s.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it("sin custom ni exclude devuelve el base tal cual", () => {
    expect(buildEnvSpecs(huemulEnvSpecsBase)).toEqual(huemulEnvSpecsBase);
  });
});
