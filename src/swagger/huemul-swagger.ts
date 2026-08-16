import { IHuemulColumnDef } from "../interfaces/interface-huemul-column-def";
import { huemulBaseColumnsInfo } from "../interfaces/interface-huemul-base-data-v1";

/* ============================ Tipos públicos ============================ */

export type HuemulHttpMethod = "get" | "post" | "put" | "delete";

export interface HuemulSwaggerExtra {
  method: HuemulHttpMethod;
  path: string;            // relativo al prefix, ej. "/upload/v1/"
  summary?: string;
  multipart?: boolean;     // body archivo → multipart/form-data { file: binary }
  bodySchema?: object;     // schema OpenAPI inline para bodies no derivables de ColumnsInfo
  successFamily?: HuemulResponseFamily; // default "Ok200"
}

export interface HuemulSwaggerModuleDef {
  module: string;          // nombre carpeta/interface, ej. "gcCountry"
  prefix: string;          // prefijo montado en routes, ej. "/gcCountry"
  standardCrud?: boolean;  // default true → 6 endpoints CRUD desde ColumnsInfo
  pkName?: string;         // default `${module}Id`
  extra?: HuemulSwaggerExtra[];
}

export interface HuemulSwaggerOptions {
  basePath?: string;       // default "/api"
  security?: object[];     // default [{ bearerAuth: [] }]
}

export type HuemulResponseFamily =
  | "Ok200" | "Created201" | "BadRequest400"
  | "Unauthorized401" | "Forbidden403" | "ServerError500";

type OpenApiObj = Record<string, any>;

/* ===================== Mapeo de columna → propiedad ===================== */

export function huemulColumnToOpenApi(col: IHuemulColumnDef): OpenApiObj {
  const type = (col.columnType || "").toLowerCase();
  let prop: OpenApiObj;

  switch (type) {
    case "number":
      prop = (col.columnPrecision && col.columnPrecision > 0)
        ? { type: "number", format: "double" }
        : { type: "integer" };
      break;
    case "boolean":
      prop = { type: "boolean" };
      break;
    case "date":
      prop = { type: "string", format: "date" };
      break;
    case "timestamp":
    case "timestamptz":
      prop = { type: "string", format: "date-time" };
      break;
    case "jsonb":
      prop = { type: "object", additionalProperties: true };
      break;
    case "string":
    case "picker":
    case "color":
    case "image":
      prop = { type: "string" };
      if (col.columnLength && col.columnLength > 0) prop.maxLength = col.columnLength;
      break;
    default:
      prop = { type: "string" };
      break;
  }

  let description = col.columnDescription || "";
  if (type === "picker") description = `[picker] ${description}`.trim();
  if (col.PKModuleName) {
    description = `${description} (FK -> ${col.PKModuleName}.${col.PKModuleNameId ?? ""})`.trim();
  }
  if (description) prop.description = description;

  return prop;
}

/* ===================== Schemas por módulo ===================== */

const INTERNAL_COLS = new Set(
  huemulBaseColumnsInfo.map((c) => c.columnName).filter((n) => n !== "versionKey")
);

export function buildModuleSchemas(
  module: string,
  columnsInfo: IHuemulColumnDef[]
): Record<string, object> {
  const fullProps: OpenApiObj = {};
  const bodyProps: OpenApiObj = {};
  const bodyRequired: string[] = [];

  for (const col of columnsInfo) {
    const prop = huemulColumnToOpenApi(col);
    fullProps[col.columnName] = prop;
    if (!INTERNAL_COLS.has(col.columnName)) {
      bodyProps[col.columnName] = prop;
      if (col.required && !col.allowNull) bodyRequired.push(col.columnName);
    }
  }

  const schemas: Record<string, object> = {
    [module]: { type: "object", properties: fullProps },
    [`${module}Body`]: {
      type: "object",
      properties: bodyProps,
      ...(bodyRequired.length ? { required: bodyRequired } : {}),
    },
  };
  return schemas;
}

/* ===================== Helpers de operación ===================== */

function headerParams(): OpenApiObj[] {
  return [
    { name: "orgid", in: "header", required: true, schema: { type: "string" },
      description: "Organization Id" },
    { name: "Authorization", in: "header", required: false, schema: { type: "string" },
      description: "Bearer token" },
  ];
}

function responsesFor(success: HuemulResponseFamily): OpenApiObj {
  const ref = (f: HuemulResponseFamily) => ({ $ref: `#/components/responses/Huemul${f}` });
  const out: OpenApiObj = {};
  if (success === "Created201") out["201"] = ref("Created201");
  else out["200"] = ref("Ok200");
  out["400"] = ref("BadRequest400");
  out["401"] = ref("Unauthorized401");
  out["403"] = ref("Forbidden403");
  out["500"] = ref("ServerError500");
  return out;
}

function jsonBody(schemaRefOrObj: object, required = true): OpenApiObj {
  return { required, content: { "application/json": { schema: schemaRefOrObj } } };
}

/* ===================== Paths CRUD ===================== */

export function buildCrudPaths(
  def: HuemulSwaggerModuleDef,
  opts: HuemulSwaggerOptions = {}
): Record<string, object> {
  if (def.standardCrud === false) return {};

  const base = (opts.basePath ?? "/api") + def.prefix;
  const pk = def.pkName ?? `${def.module}Id`;
  const security = opts.security ?? [{ bearerAuth: [] }];
  const tags = [def.module];
  const bodyRef = { $ref: `#/components/schemas/${def.module}Body` };
  const itemRef = { $ref: `#/components/schemas/${def.module}` };

  const op = (summary: string, extra: OpenApiObj = {}): OpenApiObj => ({
    tags, summary, security, parameters: headerParams(), ...extra,
  });

  const paths: Record<string, object> = {};

  paths[`${base}/v1/`] = {
    post: op(`Create ${def.module}`, {
      requestBody: jsonBody(bodyRef), responses: responsesFor("Created201"),
    }),
    put: op(`Update ${def.module}`, {
      requestBody: jsonBody(bodyRef), responses: responsesFor("Ok200"),
    }),
    get: op(`List ${def.module}`, {
      parameters: [
        ...headerParams(),
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 100 } },
        { name: "compareType", in: "query", schema: { type: "string" } },
      ],
      responses: responsesFor("Ok200"),
    }),
  };

  paths[`${base}/v1/{${pk}}`] = {
    get: op(`Get ${def.module} by id`, {
      parameters: [
        ...headerParams(),
        { name: pk, in: "path", required: true, schema: { type: "string" } },
      ],
      responses: responsesFor("Ok200"),
    }),
    delete: op(`Delete ${def.module}`, {
      parameters: [
        ...headerParams(),
        { name: pk, in: "path", required: true, schema: { type: "string" } },
      ],
      responses: responsesFor("Ok200"),
    }),
  };

  paths[`${base}/multi/delete/v1/`] = {
    put: op(`Delete multiple ${def.module}`, {
      requestBody: jsonBody({
        type: "object",
        properties: { [`${def.module}IdList`]: { type: "string", example: "id1,id2,id3" } },
        required: [`${def.module}IdList`],
      }),
      responses: responsesFor("Ok200"),
    }),
  };

  // itemRef se referencia para asegurar que el schema full quede usado por la UI.
  void itemRef;
  return paths;
}

/* ===================== Paths custom (extra) ===================== */

export function buildExtraPaths(
  def: HuemulSwaggerModuleDef,
  opts: HuemulSwaggerOptions = {}
): Record<string, object> {
  if (!def.extra?.length) return {};
  const base = (opts.basePath ?? "/api") + def.prefix;
  const security = opts.security ?? [{ bearerAuth: [] }];
  const tags = [def.module];
  const paths: Record<string, object> = {};

  for (const e of def.extra) {
    // Convierte ':param' de Express a '{param}' de OpenAPI y agrega los path params.
    const pathParamNames = (e.path.match(/:([A-Za-z0-9_]+)/g) ?? []).map((s) => s.slice(1));
    const openapiPath = e.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    const fullPath = base + openapiPath;
    const pathParams = pathParamNames.map((name) => ({
      name, in: "path", required: true, schema: { type: "string" },
    }));
    const op: OpenApiObj = {
      tags, summary: e.summary ?? `${e.method.toUpperCase()} ${e.path}`,
      security, parameters: [...headerParams(), ...pathParams],
      responses: responsesFor(e.successFamily ?? "Ok200"),
    };
    if (e.multipart) {
      op.requestBody = {
        required: true,
        content: {
          "multipart/form-data": {
            schema: { type: "object", properties: { file: { type: "string", format: "binary" } } },
          },
        },
      };
    } else if (e.bodySchema) {
      op.requestBody = jsonBody(e.bodySchema);
    }
    paths[fullPath] = { ...(paths[fullPath] ?? {}), [e.method]: op };
  }
  return paths;
}

/* ===================== Componentes de respuesta (envoltorio HuemulLog) ===================== */

export function huemulResponseComponents(): {
  schemas: Record<string, object>;
  responses: Record<string, object>;
} {
  const envelope = {
    type: "object",
    properties: {
      isSuccessful: { type: "boolean", example: true },
      httpStatusCode: { type: "integer", example: 200 },
      apiVersion: { type: "string", example: "1.0" },
      message: { type: "string", example: "Successful" },
      errors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            errorId: { type: "integer", example: 0 },
            errorTxt: { type: "string", example: "" },
          },
        },
      },
      startDate: { type: "string" },
      elapsedTimeMS: { type: "integer", example: 4 },
      transactionId: { type: "string", example: "c7632047-0bfb-4ccf-8427-26998b2356de" },
      extraInfo: { type: "array", items: { type: "object" } },
      appVersions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            appName: { type: "string" },
            appPlatform: { type: "string" },
            appVersion: { type: "string" },
          },
        },
      },
      data: {},
    },
  };

  const mkResponse = (description: string): object => ({
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/HuemulResponse" } } },
  });

  return {
    schemas: { HuemulResponse: envelope },
    responses: {
      HuemulOk200: mkResponse("OK"),
      HuemulCreated201: mkResponse("Created"),
      HuemulBadRequest400: mkResponse("Validation error"),
      HuemulUnauthorized401: mkResponse("Unauthorized"),
      HuemulForbidden403: mkResponse("Forbidden"),
      HuemulServerError500: mkResponse("Internal server error"),
    },
  };
}

/* ===================== Orquestador ===================== */

export function buildHuemulOpenApiPaths(
  defs: HuemulSwaggerModuleDef[],
  loader: (module: string) => IHuemulColumnDef[] | undefined,
  opts: HuemulSwaggerOptions = {}
): { paths: Record<string, object>; schemas: Record<string, object> } {
  const paths: Record<string, object> = {};
  const schemas: Record<string, object> = {};

  for (const def of defs) {
    try {
      if (def.standardCrud !== false) {
        const cols = loader(def.module);
        if (Array.isArray(cols)) {
          Object.assign(schemas, buildModuleSchemas(def.module, cols));
          Object.assign(paths, buildCrudPaths(def, opts));
        } else {
          console.warn("[huemulSwagger] sin ColumnsInfo, se omite CRUD:", def.module);
        }
      }
      // extras siempre
      const extra = buildExtraPaths(def, opts);
      for (const [p, item] of Object.entries(extra)) {
        paths[p] = { ...(paths[p] as object ?? {}), ...(item as object) };
      }
    } catch (err) {
      console.warn("[huemulSwagger] error procesando módulo", def.module, err);
    }
  }

  return { paths, schemas };
}
