/**
 * TypeScript type definitions for Swagger/OpenAPI specifications
 */

export interface SwaggerSpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, Schema>;
    parameters?: Record<string, Parameter>;
    responses?: Record<string, Response>;
    requestBodies?: Record<string, RequestBody>;
  };
  // Swagger 2.0 compatibility
  definitions?: Record<string, Schema | Reference>;
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  parameters?: Parameter[];
}

export interface Operation {
  operationId: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody | Reference;
  responses: Record<string, Response | Reference>;
  security?: SecurityRequirement[];
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie' | 'body'; // 'body' for Swagger 2.0
  description?: string;
  required?: boolean;
  schema?: Schema | Reference;
  type?: string;
  format?: string;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface MediaType {
  schema?: Schema | Reference;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
  schema?: Schema | Reference;
}

export interface Schema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, Schema | Reference>;
  required?: string[];
  items?: Schema | Reference;
  allOf?: Array<Schema | Reference>;
  oneOf?: Array<Schema | Reference>;
  anyOf?: Array<Schema | Reference>;
  enum?: unknown[];
  default?: unknown;
  $ref?: string;
}

export interface Reference {
  $ref: string;
}

export interface SecurityRequirement {
  [name: string]: string[];
}

/**
 * Type guard to check if a schema is a reference
 */
export function isReference(obj: Schema | Reference): obj is Reference {
  return '$ref' in obj && typeof obj.$ref === 'string';
}

/**
 * Type guard to check if a response is a reference
 */
export function isResponseReference(obj: Response | Reference): obj is Reference {
  return '$ref' in obj && typeof obj.$ref === 'string';
}

/**
 * Type guard to check if a request body is a reference
 */
export function isRequestBodyReference(obj: RequestBody | Reference): obj is Reference {
  return '$ref' in obj && typeof obj.$ref === 'string';
}

