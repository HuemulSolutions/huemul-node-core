# Instrucciones: Crear estructura base de `huemul-core`

Ejecutar estos pasos en orden. Al final se indica qué archivos copiar manualmente desde `gestion-costo-backend`.

---

## 1. Crear carpetas

```bash
mkdir huemul-core
cd huemul-core

mkdir -p src/functions
mkdir -p src/filters
mkdir -p src/logging
mkdir -p src/interfaces
mkdir -p .github/workflows
```

---

## 2. Inicializar git y conectar con GitHub

```bash
git init
git remote add origin https://github.com/TU-ORG/huemul-core.git
```

> Reemplazar `TU-ORG` con el nombre de la organización o usuario de GitHub.

---

## 3. Crear `package.json`

Crear el archivo `package.json` en la raíz con este contenido:

```json
{
  "name": "@TU-ORG/huemul-core",
  "version": "1.0.0",
  "description": "Huemul core framework: logging, filters, utilities",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "prepublishOnly": "npm run build"
  },
  "engines": {
    "node": ">=18"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^6.0.2",
    "@types/node": "^24.0.0"
  }
}
```

> Reemplazar `TU-ORG` con el nombre real de la org/usuario.

---

## 4. Crear `tsconfig.json`

Crear el archivo `tsconfig.json` en la raíz:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2024",
    "lib": ["es2024"],
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "resolveJsonModule": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 5. Crear `.npmrc`

Crear el archivo `.npmrc` en la raíz:

```
@TU-ORG:registry=https://npm.pkg.github.com
```

> Reemplazar `TU-ORG` con el nombre real.

---

## 6. Crear `.gitignore`

Crear el archivo `.gitignore` en la raíz:

```
node_modules/
dist/
*.js.map
.env
.env.*
```

---

## 7. Crear GitHub Actions: publicación automática

Crear el archivo `.github/workflows/publish.yml`:

```yaml
name: Publish Package

on:
  push:
    tags:
      - "v*"

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "24"
          registry-url: "https://npm.pkg.github.com"

      - run: npm ci
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 8. Crear `src/index.ts`

Crear el archivo `src/index.ts` con este contenido (barrel export):

```typescript
// Funciones utilitarias
export * from "./functions/huemul-functions";

// Filtros y clases de filtro
export * from "./filters/huemul-filters";

// Logging estructurado
export * from "./logging/huemul-log";

// PostgreSQL helpers
export * from "./gen-postgres-base";

// Interfaces
export * from "./interfaces/interface-huemul-base-data-v1";
export * from "./interfaces/interface-huemul-filter";
export * from "./interfaces/interface-huemul-column-def";
export * from "./interfaces/interface-huemul-appversion-v1";
export * from "./interfaces/interface-huemul-trace-data-v1";
```

---

## 9. Instalar dependencias

```bash
npm install
```

---

## 10. Archivos a copiar manualmente desde `gestion-costo-backend`

Copiar cada archivo al destino indicado dentro de `huemul-core/`:

| Archivo origen (en `gestion-costo-backend`)                                        | Destino (en `huemul-core`)                            |
|------------------------------------------------------------------------------------|-------------------------------------------------------|
| `src/common/huemul/huemul-functions.ts`                                            | `src/functions/huemul-functions.ts`                   |
| `src/common/huemul/huemul-filters.ts`                                              | `src/filters/huemul-filters.ts`                       |
| `src/common/huemul/huemul-log.ts`                                                  | `src/logging/huemul-log.ts`                           |
| `src/common/huemul/gen-postgres-base.ts`                                           | `src/gen-postgres-base.ts`                            |
| `src/common/huemul/interfaces/interface-huemul-base-data-v1.ts`                    | `src/interfaces/interface-huemul-base-data-v1.ts`     |
| `src/common/huemul/interfaces/interface-huemul-filter.ts`                          | `src/interfaces/interface-huemul-filter.ts`           |
| `src/common/huemul/interfaces/interface-huemul-column-def.ts`                      | `src/interfaces/interface-huemul-column-def.ts`       |
| `src/common/huemul/interfaces/interface-huemul-appversion-v1.ts`                   | `src/interfaces/interface-huemul-appversion-v1.ts`    |
| `src/common/huemul/interfaces/interface-huemul-trace-data-v1.ts`                   | `src/interfaces/interface-huemul-trace-data-v1.ts`    |

---

## 11. Estructura final esperada

Después de copiar los archivos, la estructura debe verse así:

```
huemul-core/
├── .github/
│   └── workflows/
│       └── publish.yml
├── src/
│   ├── functions/
│   │   └── huemul-functions.ts
│   ├── filters/
│   │   └── huemul-filters.ts
│   ├── logging/
│   │   └── huemul-log.ts
│   ├── interfaces/
│   │   ├── interface-huemul-base-data-v1.ts
│   │   ├── interface-huemul-filter.ts
│   │   ├── interface-huemul-column-def.ts
│   │   ├── interface-huemul-appversion-v1.ts
│   │   └── interface-huemul-trace-data-v1.ts
│   ├── gen-postgres-base.ts
│   └── index.ts
├── .gitignore
├── .npmrc
├── package.json
└── tsconfig.json
```

---

## 12. Verificar que compila (antes de refactorizar imports)

```bash
npm run build
```

En este punto va a fallar porque los archivos todavía importan desde `../../global` y rutas relativas del proyecto original. Eso es esperado — el siguiente paso es el refactor de imports.

---

## Próximo paso: Refactor de imports

Ver `external_package.md` sección "Fase 1 — Paso 5" para los cambios exactos a hacer en cada archivo antes de que compile limpiamente.
