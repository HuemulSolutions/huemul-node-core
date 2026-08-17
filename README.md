# @huemulsolutions/huemul-node-core

Core framework compartido entre todos los proyectos Node.js de HuemulSolutions. Incluye logging estructurado, filtros, funciones utilitarias, helpers de PostgreSQL e interfaces base.

---

## Contenido

| Módulo | Descripción |
|---|---|
| `HuemulConfig` | Configuración global del framework (inicializar una vez al arrancar) |
| `checkEnv` / `printEnvCheck` | Validación de variables de entorno al arranque, con catálogo base reutilizable |
| `HuemulLog` | Logging estructurado con soporte para Azure y Google Cloud |
| `consoleLogger` | Logger de consola legible, usado por defecto si la app no configura otro |
| `errorMessages` | Mensajes de error i18n (es / en) |
| `HuemulFilters` | Generación de cláusulas WHERE tipadas para SQL |
| `huemul-functions` | Funciones utilitarias (hash, cifrado, fechas, base64, etc.) |
| `dataTypeToPostgres` | Mapeo de tipos del framework a tipos PostgreSQL |
| `huemul-swagger` | Generador OpenAPI 3.0 puro (schemas + paths CRUD + extras) desde `IHuemulColumnDef[]` |
| `CloudProviderType`, `DatabaseType`, etc. | Enums del framework |
| Interfaces `IHuemulBaseData`, `IHuemulFilter`, etc. | Contratos base de datos y filtros |

---

## Instalación

Agrega el archivo `.npmrc` en la raíz de tu proyecto apuntando al registry de GitHub Packages:

```
@huemulsolutions:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Luego instala el paquete:

```bash
npm install @huemulsolutions/huemul-node-core
```

---

## Uso

### 1. Configuración inicial (una vez al arrancar la app)

Llama a `HuemulConfig.configure()` al inicio de tu aplicación, antes de cualquier otro uso del framework:

```typescript
import { HuemulConfig, CloudProviderType } from "@huemulsolutions/huemul-node-core";

HuemulConfig.configure({
  appName: process.env.APP_NAME ?? "mi-app",
  cloudProvider: process.env.CLOUD_PROVIDER as CloudProviderType ?? CloudProviderType.google,
  appVersions: [
    {
      appName: "mi-app",
      appPlatform: "WEB",
      appVersion: process.env.APP_WEB_VERSION ?? "0.0.0",
    },
  ],
  // logger: opcional. Si lo omites se usa consoleLogger(), que imprime el motivo de cada error de
  // forma legible. Pásalo solo si quieres otro destino (Google Cloud Logging, App Insights, etc.)
});
```

Una vez configurado, todas las clases del framework (`HuemulLog`, `getHeaderByName`, etc.) leen automáticamente desde `HuemulConfig`.

---

### 1.b Validación de variables de entorno

Las apps leen su configuración con `process.env.X ?? ""`, así que una variable ausente o **vacía** es
indistinguible de una bien configurada: el server arranca sin decir nada y falla mucho después con un
error genérico (`SECRET_KEY_JWT` vacío, por ejemplo, hace que RBAC devuelva un 401 idéntico al de una
contraseña mala).

Llama a `printEnvCheck()` en `app.ts`, justo después de `dotenv.config()` y **antes** de importar los
módulos que congelan las constantes de configuración:

```typescript
import dotenv from "dotenv";
dotenv.config();

import { buildEnvSpecs, huemulEnvSpecsBase, printEnvCheck, IHuemulEnvSpec } from "@huemulsolutions/huemul-node-core";

// Variables propias de esta app
const misSpecs: IHuemulEnvSpec[] = [
  {name: "MI_API_TOKEN", severity: "critical", group: "Negocio", usedFor: "token de la API de XYZ"},
];

printEnvCheck(buildEnvSpecs(huemulEnvSpecsBase, misSpecs));

import "./rbac-setup";   // a partir de aquí las constantes quedan congeladas
```

**Solo imprime warnings, nunca aborta**: un entorno a medio configurar igual levanta, para poder
diagnosticarlo. Qué detecta:

| Detección | Por qué importa |
|---|---|
| Variable ausente | Lo obvio |
| Variable **definida pero vacía** o con solo espacios | `SECRET_KEY_JWT=` se comporta igual que no tenerla; un chequeo por `undefined` no la ve |
| Valor fuera de `allowedValues` | `DATABASE_TYPE=mysql` o `ENVIROMENT=dev` se aceptan en silencio y fallan después |
| Formato inválido (`validate`) | Un `ADMIN_SERVER_ADDRESS` sin puerto deja la conexión con `port: NaN` |

**Severidades**: `critical` (sin esto el backend no funciona), `recommended` (hay default, pero operar
sin ella casi siempre es un error de configuración), `optional` (solo si usas esa funcionalidad; se
resumen en una línea para no enterrar a las que importan).

**Catálogo base**. El package trae las specs de las variables que alimentan a los packages Huemul,
agrupadas para poder tomarlas por partes:

`huemulEnvSpecsDatabase`, `huemulEnvSpecsRbac`, `huemulEnvSpecsApp`, `huemulEnvSpecsEmail`,
`huemulEnvSpecsStorage`, `huemulEnvSpecsKeyVault`, y `huemulEnvSpecsBase` con todas.

Los nombres son la convención de los proyectos Huemul, no un contrato del package —los packages no
leen `process.env`, reciben su configuración por inyección—, así que `buildEnvSpecs` permite ajustarlos:

```typescript
buildEnvSpecs(
  huemulEnvSpecsBase,
  [
    // mismo nombre que una del base -> la reemplaza en su misma posición
    {name: "URL_WEB", severity: "critical", group: "Entorno", usedFor: "obligatoria en esta app"},
    // nombre nuevo -> se agrega al final
    {name: "STORAGE_URL_BASE_GENERAL_INV", severity: "optional", group: "Storage", usedFor: "URL base del storage"},
  ],
  ["STORAGE_URL_BASE_GENERAL"],   // se quitan del base (aquí, por renombre)
);
```

Para variables numéricas usa `numberFromEnv(process.env.X, 50)` y **no** `Number(process.env.X) ?? 50`:
`Number(undefined)` devuelve `NaN`, que no es null ni undefined, así que el `??` nunca entrega el
default y la constante queda en `NaN`.

---

### 2. Logging

```typescript
import { HuemulLog, layerType, errorType } from "@huemulsolutions/huemul-node-core";

enum moduleType {
  users = "users",
  products = "products",
}

// Crear una instancia por operación
const log = new HuemulLog(layerType.logic, moduleType.users, "getById", "userLogicGetById", "1.0");

// Registrar pasos intermedios
log.setStepName("query-db");

// Finalizar con éxito
return log.finishSuccessfullyForDataLayer([result]);

// Finalizar con error
return log.finishErrorForDataLayer(errorType.dbRecordNotFound, "Usuario no encontrado");
```

#### Destino de los logs

`HuemulConfig.logger` solo necesita exponer `.info() / .debug() / .warn() / .error()` con la forma
`(message, meta)`. Si no configuras uno, se usa `consoleLogger()`:

- el cierre exitoso de cada `HuemulLog` **no se imprime** —antes salía un `transactionId` suelto, que
  no aporta y entierra lo que sí importa—;
- ante un error se imprimen `stepName`, `errorTxt`, `orgId`, `url`… y sobre todo **`extraInfo`**, que
  es donde el framework deja el mensaje crudo cuando al cliente se le responde uno genérico
  (`finishErrorForDataLayer` con `dbOther` / `dbDataValidation`).

Ese último punto es el que hace diagnosticable un error: cuando devuelvas un genérico al cliente
(401/403/426), deja la causa concreta en `whatIDid.extraInfo` y el logger la imprime.

```typescript
huemulLog.whatIDid.extraInfo = {
  unauthorizedReason: "falta el header 'authorization'",
  ...huemulLog.whatIDid.extraInfo,
};
```

Para silenciar la salida pasa un logger con los cuatro métodos vacíos; dejar `logger` en `undefined`
no apaga nada, solo activa el de consola.

---

### 3. Mensajes de error i18n

```typescript
import { errorMessages } from "@huemulsolutions/huemul-node-core";

const lang = log.whoIAm.humanLanguage; // "es" o "en"

errorMessages.errorDataDoesntExist(lang, "users", userId);
// es: "El registro no existe"
// en: "Record doesn't exist"

errorMessages.forbidden(lang);
errorMessages.errorDataCantUpdate(lang);
errorMessages.errorLengthGreaterThan(lang, "name", value, 100);
```

---

### 4. Tipos y enums

```typescript
import {
  CloudProviderType,
  DatabaseType,
  HuemulEnvironmentType,
  UserManagerType,
} from "@huemulsolutions/huemul-node-core";

const provider = CloudProviderType.google;    // "google"
const db       = DatabaseType.postgres;       // "postgres"
const env      = HuemulEnvironmentType.PROD;  // "PROD"
```

---

### 5. Filtros SQL

```typescript
import {
  HuemulFilters,
  HuemulFilterString,
  HuemulFilterNumber,
  HuemulFilterOperators,
  HuemulColumnClass,
} from "@huemulsolutions/huemul-node-core";

class UserFilters extends HuemulFilters {
  name   = new HuemulFilterString(HuemulColumnClass.NORMAL);
  age    = new HuemulFilterNumber(HuemulColumnClass.NORMAL);
  id     = new HuemulFilterNumber(HuemulColumnClass.PK);
}

const filters = new UserFilters();
filters.name.addFilter("john", HuemulFilterOperators.LIKE);
filters.age.addFilter(18, HuemulFilterOperators.GREATER_THAN_OR_EQUAL);

const sql = filters.getWhereClause();
// where (UPPER("base"."name") LIKE '%JOHN%') AND ("base"."age" >= 18)
```

---

### 6. Generador OpenAPI / Swagger

Produce un documento **OpenAPI 3.0 en JSON plano** a partir de los `IHuemulColumnDef[]` que ya exporta cada módulo: schemas por módulo, los 6 paths CRUD estándar, endpoints custom (`extra`) y el envoltorio de respuesta `HuemulResponse`.

> **Sin dependencias nuevas.** Core solo genera el JSON; servir la UI (`swagger-ui-express`) es responsabilidad de cada app consumidora.

```typescript
import {
  buildHuemulOpenApiPaths,
  huemulResponseComponents,
  HuemulSwaggerModuleDef,
} from "@huemulsolutions/huemul-node-core";

// 1. Definí los módulos a exponer
const defs: HuemulSwaggerModuleDef[] = [
  { module: "gcCountry", prefix: "/gcCountry" },
  {
    module: "gcFile",
    prefix: "/gcFile",
    extra: [{ method: "post", path: "/upload/v1/", multipart: true }],
  },
];

// 2. Loader que devuelve los ColumnsInfo de cada módulo
const loader = (module: string) => columnsInfoByModule[module];

// 3. Generá paths + schemas de los módulos y los componentes base
const { paths, schemas } = buildHuemulOpenApiPaths(defs, loader, { basePath: "/api" });
const core = huemulResponseComponents();

// 4. Armá el documento OpenAPI final
const swaggerSpec = {
  openapi: "3.0.0",
  info: { title: "Mi API", version: "1.0.0" },
  servers: [{ url: "http://localhost:" + port }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: { ...core.schemas, ...schemas }, // ⚠️ merge: core primero, módulos después
    responses: core.responses,
  },
  paths,
};

// La app sirve la UI con swagger-ui-express (core NO lo hace)
```

> **Importante:** los `schemas` de core (`HuemulResponse`) y los de los módulos deben **fusionarse** (`{ ...core.schemas, ...schemas }`), no sobrescribirse. Las `responses` reutilizables van bajo `components.responses`.

---

## Publicación

El paquete se publica automáticamente en **GitHub Packages** al hacer push de un tag con formato `v*`. El workflow ejecuta los tests antes de publicar — si algún test falla, la publicación se cancela.

### Primera versión (sin tag previo)

Si es la primera vez que publicas o el tag aún no existe en el repositorio remoto:

```bash
git tag v1.0.1
git push origin main --tags
```

### Flujo normal para versiones siguientes

```bash
# 1. Commiteá tus cambios normalmente
git add .
git commit -m "feat: algo nuevo"

# 2. Bump de versión (elige uno)
npm version patch   # 1.0.1 → 1.0.2
npm version minor   # 1.0.1 → 1.1.0
npm version major   # 1.0.1 → 2.0.0

# 3. Push del commit + tag en un solo comando
git push origin main --tags
```

`npm version` actualiza `package.json`, crea el commit y el tag automáticamente. El push dispara el workflow.

### Publicación manual (opcional)

```bash
npm login --registry=https://npm.pkg.github.com --scope=@huemulsolutions
npm run build
npm publish
```

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Compilar
npm run build

# Compilar en modo watch
npm run watch

# Ejecutar tests
npm test

# Tests en modo interactivo
npm run test:watch

# Reporte de cobertura
npm run test:coverage
```

Para probar el paquete localmente en otro proyecto antes de publicar:

```bash
# En este repositorio
npm link

# En el proyecto consumidor
npm link @huemulsolutions/huemul-node-core
```
