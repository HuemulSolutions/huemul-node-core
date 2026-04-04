# @huemulsolutions/huemul-node-core

Core framework compartido entre todos los proyectos Node.js de HuemulSolutions. Incluye logging estructurado, filtros, funciones utilitarias, helpers de PostgreSQL e interfaces base.

---

## Contenido

| Módulo | Descripción |
|---|---|
| `HuemulConfig` | Configuración global del framework (inicializar una vez al arrancar) |
| `HuemulLog` | Logging estructurado con soporte para Azure y Google Cloud |
| `errorMessages` | Mensajes de error i18n (es / en) |
| `HuemulFilters` | Generación de cláusulas WHERE tipadas para SQL |
| `huemul-functions` | Funciones utilitarias (hash, cifrado, fechas, base64, etc.) |
| `dataTypeToPostgres` | Mapeo de tipos del framework a tipos PostgreSQL |
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
  logger: undefined, // pasa aquí tu logger (Winston, Bunyan, Google Cloud Logging, etc.)
});
```

Una vez configurado, todas las clases del framework (`HuemulLog`, `getHeaderByName`, etc.) leen automáticamente desde `HuemulConfig`.

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
