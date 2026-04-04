# @HuemulSolutions/huemul-node-core

Core framework compartido entre todos los proyectos Node.js de HuemulSolutions. Incluye logging estructurado, filtros, funciones utilitarias, helpers de PostgreSQL e interfaces base.

---

## Contenido

| Módulo | Descripción |
|---|---|
| `HuemulLog` | Logging estructurado con soporte para Azure y Google Cloud |
| `errorMessages` | Mensajes de error i18n (es / en) |
| `HuemulFilters` | Clase de filtros para consultas |
| `huemul-functions` | Funciones utilitarias (hash, fechas, headers, etc.) |
| `gen-postgres-base` | Helpers base para PostgreSQL |
| `CloudProviderType`, `DatabaseType`, etc. | Enums del framework |
| Interfaces `IHuemulBaseData`, `IHuemulFilter`, etc. | Contratos base de datos y filtros |

---

## Instalación

Agrega el archivo `.npmrc` en la raíz de tu proyecto apuntando al registry de GitHub Packages:

```
@HuemulSolutions:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

Luego instala el paquete:

```bash
npm install @HuemulSolutions/huemul-node-core
```

---

## Uso

### 1. Configuración inicial (una vez al arrancar la app)

Llama a `HuemulLog.configure()` al inicio de tu aplicación (antes de cualquier uso de `HuemulLog`):

```typescript
import { HuemulLog, CloudProviderType } from "@HuemulSolutions/huemul-node-core";

HuemulLog.configure({
  appName: process.env.APP_NAME ?? "mi-app",
  cloudProvider: process.env.CLOUD_PROVIDER ?? CloudProviderType.google,
  appVersions: [
    {
      appName: "mi-app",
      appPlatform: "WEB",
      appVersion: process.env.APP_WEB_VERSION ?? "0.0.0",
    },
  ],
});
```

Una vez configurado, `HuemulLog.appName`, `HuemulLog.cloudProvider` y `HuemulLog.appVersions` están disponibles en cualquier parte del código.

---

### 2. Logging

```typescript
import { HuemulLog, layerType, errorType } from "@HuemulSolutions/huemul-node-core";

// Definir los módulos de tu app como enum string
enum moduleType {
  users = "users",
  products = "products",
}

// Crear una instancia por operación
const log = new HuemulLog(layerType.logic, moduleType.users, "getById", "userLogicGetById", "1.0");

// Registrar pasos
log.setStepName("query-db");

// Finalizar con éxito
return log.finishSuccessfullyForDataLayer([result]);

// Finalizar con error
return log.finishErrorForDataLayer(errorType.dbRecordNotFound, "Usuario no encontrado");
```

---

### 3. Mensajes de error i18n

```typescript
import { errorMessages } from "@HuemulSolutions/huemul-node-core";

const lang = whoIAm.humanLanguage; // "es" o "en"

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
} from "@HuemulSolutions/huemul-node-core";

const provider = CloudProviderType.google;       // "google"
const db       = DatabaseType.postgres;          // "postgres"
const env      = HuemulEnvironmentType.PROD;     // "PROD"
```

---

### 5. Filtros

```typescript
import { HuemulFilters } from "@HuemulSolutions/huemul-node-core";

const filters = new HuemulFilters();
filters.addFilter("status", "=", "active");
```

---

## Publicación

El paquete se publica automáticamente en **GitHub Packages** al hacer push de un tag con formato `v*`.

### Pasos para publicar una nueva versión

1. Actualiza la versión en `package.json`:
   ```bash
   npm version patch   # 1.0.0 → 1.0.1
   npm version minor   # 1.0.0 → 1.1.0
   npm version major   # 1.0.0 → 2.0.0
   ```

2. Haz push del commit y el tag generado:
   ```bash
   git push origin main --tags
   ```

3. El workflow `.github/workflows/publish.yml` ejecuta `npm publish` automáticamente.

### Publicación manual (opcional)

Si necesitas publicar sin crear un tag:

```bash
# Autenticarse con GitHub Packages
npm login --registry=https://npm.pkg.github.com --scope=@HuemulSolutions

# Compilar y publicar
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
```

Para probar el paquete localmente en otro proyecto antes de publicar, usa `npm link`:

```bash
# En este repositorio
npm link

# En el proyecto consumidor
npm link @HuemulSolutions/huemul-node-core
```
