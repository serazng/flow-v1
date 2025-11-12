import { readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import { validateAndResolvePath, validatePathExists } from '../utils/path-utils.js';
import { validateSwaggerSpec } from '../utils/swagger-validator.js';
import { logger } from '../utils/logger.js';
import type { SwaggerSpec, Schema, Reference, Operation, Parameter } from '../types/swagger.js';
import { isReference, isRequestBodyReference } from '../types/swagger.js';

export async function generateFrontend(swaggerPath: string, outputDir: string) {
  try {
    // Validate and resolve paths securely
    const fullPath = validateAndResolvePath(swaggerPath);
    await validatePathExists(fullPath);
    
    const outputPath = validateAndResolvePath(outputDir);
    
    logger.info(`Generating frontend code from ${swaggerPath} to ${outputDir}`);
    
    const content = await readFile(fullPath, 'utf-8');
    
    let parsed: unknown;
    if (swaggerPath.endsWith('.yaml') || swaggerPath.endsWith('.yml')) {
      parsed = yaml.load(content);
    } else {
      parsed = JSON.parse(content);
    }
    
    // Validate the spec
    if (!validateSwaggerSpec(parsed)) {
      throw new Error('Invalid Swagger specification');
    }
    
    const spec = parsed as SwaggerSpec;
    
    // Generate TypeScript types
    // Support both OpenAPI 3.0 (components.schemas) and Swagger 2.0 (definitions)
    const allSchemas: Record<string, Schema | Reference> = {};
    if (spec.components?.schemas) {
      Object.assign(allSchemas, spec.components.schemas);
    }
    if (spec.definitions) {
      Object.assign(allSchemas, spec.definitions);
    }
    
    if (Object.keys(allSchemas).length > 0) {
      const typesDir = join(outputPath, 'src', 'types');
      await mkdir(typesDir, { recursive: true });
      
      const typesCode = generateTypeScriptTypes(allSchemas, spec);
      await writeFile(join(typesDir, 'generated.ts'), typesCode);
    }
    
    // Generate API client
    const servicesDir = join(outputPath, 'src', 'services');
    await mkdir(servicesDir, { recursive: true });
    
    const apiCode = generateApiClient(spec.paths, spec);
    await writeFile(join(servicesDir, 'generated-api.ts'), apiCode);
    
    logger.info('Frontend code generated successfully');
    
    return {
      content: [
        {
          type: 'text',
          text: `Frontend code generated successfully in ${outputDir}`,
        },
      ],
    };
  } catch (error) {
    logger.error(`Failed to generate frontend code: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error: Failed to generate frontend code: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

function generateTypeScriptTypes(
  schemas: Record<string, Schema | Reference>,
  spec: SwaggerSpec
): string {
  const types: string[] = [];
  
  // Build allSchemas including both components.schemas and definitions for reference resolution
  const allSchemas: Record<string, Schema | Reference> = { ...schemas };
  if (spec.components?.schemas) {
    Object.assign(allSchemas, spec.components.schemas);
  }
  if (spec.definitions) {
    Object.assign(allSchemas, spec.definitions);
  }
  
  for (const [name, schema] of Object.entries(schemas)) {
    types.push(generateTypeScriptType(name, schema, allSchemas));
  }
  
  return types.join('\n\n');
}

/**
 * Resolves allOf by merging all schemas' properties for TypeScript
 */
function resolveAllOfTypeScript(
  allOf: Array<Schema | Reference>,
  allSchemas: Record<string, Schema | Reference>
): { properties: Record<string, Schema | Reference>; required: string[] } {
  const mergedProperties: Record<string, Schema | Reference> = {};
  const mergedRequired: string[] = [];
  
  for (const schemaItem of allOf) {
    let resolved = schemaItem;
    
    // Resolve reference if needed
    if (isReference(schemaItem)) {
      const refName = schemaItem.$ref.split('/').pop() || '';
      if (allSchemas[refName]) {
        resolved = allSchemas[refName];
      } else {
        continue;
      }
    }
    
    // Merge properties
    if (!isReference(resolved) && resolved.properties) {
      Object.assign(mergedProperties, resolved.properties);
      if (resolved.required) {
        mergedRequired.push(...resolved.required);
      }
    }
  }
  
  return { properties: mergedProperties, required: Array.from(new Set(mergedRequired)) };
}

function generateTypeScriptType(
  name: string,
  schema: Schema | Reference,
  allSchemas: Record<string, Schema | Reference>
): string {
  if (isReference(schema)) {
    // Extract referenced type name
    const refName = schema.$ref.split('/').pop() || 'unknown';
    return `export type ${name} = ${refName};`;
  }
  
  // Handle enum - generate union type
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    const enumValues = schema.enum.map(val => {
      if (typeof val === 'string') {
        return `"${val}"`;
      }
      return String(val);
    });
    return `export type ${name} = ${enumValues.join(' | ')};`;
  }
  
  // Handle allOf - generate intersection type
  if (schema.allOf && Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const merged = resolveAllOfTypeScript(schema.allOf, allSchemas);
    const properties: string[] = [];
    
    for (const [propName, propSchema] of Object.entries(merged.properties)) {
      const fieldDef = propSchema as Schema | Reference;
      const tsType = mapTypeToTypeScript(fieldDef, allSchemas);
      const optional = merged.required.includes(propName) ? '' : '?';
      properties.push(`  ${propName}${optional}: ${tsType};`);
    }
    
    if (properties.length > 0) {
      return `export interface ${name} {
${properties.join('\n')}
}`;
    }
    // If no properties, try to generate intersection of referenced types
    const typeRefs = schema.allOf
      .filter(s => isReference(s))
      .map(s => {
        const ref = s as Reference;
        return ref.$ref.split('/').pop() || 'unknown';
      });
    
    if (typeRefs.length > 0) {
      return `export type ${name} = ${typeRefs.join(' & ')};`;
    }
  }
  
  // Handle oneOf/anyOf - generate union type
  if ((schema.oneOf || schema.anyOf) && 
      Array.isArray(schema.oneOf || schema.anyOf) && 
      (schema.oneOf || schema.anyOf)!.length > 0) {
    const unionSchemas = schema.oneOf || schema.anyOf!;
    const unionTypes: string[] = [];
    
    for (const unionSchema of unionSchemas) {
      if (isReference(unionSchema)) {
        const refName = unionSchema.$ref.split('/').pop() || 'unknown';
        unionTypes.push(refName);
      } else {
        // For inline schemas, generate inline type
        const inlineType = mapTypeToTypeScript(unionSchema, allSchemas);
        unionTypes.push(inlineType);
      }
    }
    
    return `export type ${name} = ${unionTypes.join(' | ')};`;
  }
  
  const properties: string[] = [];
  
  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const fieldDef = propSchema as Schema | Reference;
      const tsType = mapTypeToTypeScript(fieldDef, allSchemas);
      const optional = schema.required?.includes(propName) ? '' : '?';
      properties.push(`  ${propName}${optional}: ${tsType};`);
    }
  }
  
  if (properties.length === 0) {
    // Handle array types or other non-object types
    if (schema.type === 'array' && schema.items) {
      const itemType = mapTypeToTypeScript(schema.items as Schema | Reference, allSchemas);
      return `export type ${name} = ${itemType}[];`;
    }
    
    // Fallback for empty objects
    return `export interface ${name} {
  [key: string]: unknown;
}`;
  }
  
  return `export interface ${name} {
${properties.join('\n')}
}`;
}

function generateApiClient(paths: Record<string, any>, spec: SwaggerSpec): string {
  const methods: string[] = [];
  
  for (const [path, pathItem] of Object.entries(paths)) {
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete'] as const;
    
    for (const method of httpMethods) {
      const operation = pathItem[method] as Operation | undefined;
      if (operation?.operationId) {
        methods.push(generateApiMethod(operation, method.toUpperCase(), path, spec));
      }
    }
  }
  
  return `import axios, { AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const generatedApi = {
${methods.join(',\n')}
};
`;
}

function generateApiMethod(
  operation: Operation,
  method: string,
  path: string,
  spec: SwaggerSpec
): string {
  // Extract path parameters from the path string
  const pathParams = path.match(/\{(\w+)\}/g) || [];
  const pathParamNames = pathParams.map(p => p.slice(1, -1));
  
  // Also check operation parameters for path params
  const operationPathParams = (operation.parameters || [])
    .filter(p => p.in === 'path')
    .map(p => p.name);
  
  // Combine and deduplicate
  const allPathParams = Array.from(new Set([...pathParamNames, ...operationPathParams]));
  
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
  
  // Build parameter list
  const params: string[] = [];
  
  // Add path parameters
  if (allPathParams.length > 0) {
    allPathParams.forEach(param => {
      params.push(`${param}: string`);
    });
  }
  
  // Add request body parameter
  if (hasBody && operation.requestBody) {
    // Try to infer type from request body
    let bodyType = 'unknown';
    if (!isRequestBodyReference(operation.requestBody) && operation.requestBody.content) {
      const contentTypes = Object.keys(operation.requestBody.content);
      if (contentTypes.length > 0) {
        const mediaType = operation.requestBody.content[contentTypes[0]];
        if (mediaType.schema) {
          bodyType = mapTypeToTypeScript(mediaType.schema as Schema | Reference, spec.components?.schemas || {});
        }
      }
    }
    params.push(`data: ${bodyType}`);
  }
  
  // Build parameter string
  const paramString = params.length > 0 ? `(${params.join(', ')})` : '()';
  
  // Build URL with template literals
  let url = path;
  allPathParams.forEach(param => {
    url = url.replace(`{${param}}`, `\${${param}}`);
  });
  
  // Build axios call
  const axiosCall = hasBody && params.length > allPathParams.length
    ? `apiClient.${method.toLowerCase()}<unknown>(\`${url}\`, data)`
    : `apiClient.${method.toLowerCase()}<unknown>(\`${url}\`)`;
  
  // Try to infer return type from response
  let returnType = 'unknown';
  const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['204'];
  if (successResponse && !isReference(successResponse) && successResponse.content) {
    const contentTypes = Object.keys(successResponse.content);
    if (contentTypes.length > 0) {
      const mediaType = successResponse.content[contentTypes[0]];
      if (mediaType.schema) {
        returnType = mapTypeToTypeScript(mediaType.schema as Schema | Reference, spec.components?.schemas || {});
      }
    }
  }
  
  return `  ${operation.operationId}: async ${paramString}: Promise<${returnType}> => {
    const response: AxiosResponse<${returnType}> = await ${axiosCall};
    return response.data;
  }`;
}

function mapTypeToTypeScript(
  schema: Schema | Reference,
  allSchemas: Record<string, Schema | Reference>,
  contextName: string = 'Inline'
): string {
  if (isReference(schema)) {
    // Extract type name from $ref
    const refName = schema.$ref.split('/').pop() || 'unknown';
    return refName;
  }
  
  // Handle enum - return union type
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    const enumValues = schema.enum.map(val => {
      if (typeof val === 'string') {
        return `"${val}"`;
      }
      return String(val);
    });
    return enumValues.join(' | ');
  }
  
  // Handle allOf - generate intersection type or inline interface
  if (schema.allOf && Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const merged = resolveAllOfTypeScript(schema.allOf, allSchemas);
    
    // If we have properties, generate inline interface
    if (Object.keys(merged.properties).length > 0) {
      const properties: string[] = [];
      for (const [propName, propSchema] of Object.entries(merged.properties)) {
        const fieldDef = propSchema as Schema | Reference;
        const tsType = mapTypeToTypeScript(fieldDef, allSchemas, propName);
        const optional = merged.required.includes(propName) ? '' : '?';
        properties.push(`${propName}${optional}: ${tsType}`);
      }
      return `{ ${properties.join('; ')} }`;
    }
    
    // Otherwise, try intersection of referenced types
    const typeRefs = schema.allOf
      .filter(s => isReference(s))
      .map(s => {
        const ref = s as Reference;
        return ref.$ref.split('/').pop() || 'unknown';
      });
    
    if (typeRefs.length > 0) {
      return typeRefs.join(' & ');
    }
  }
  
  // Handle oneOf/anyOf - generate union type
  if ((schema.oneOf || schema.anyOf) && 
      Array.isArray(schema.oneOf || schema.anyOf) && 
      (schema.oneOf || schema.anyOf)!.length > 0) {
    const unionSchemas = schema.oneOf || schema.anyOf!;
    const unionTypes: string[] = [];
    
    for (const unionSchema of unionSchemas) {
      if (isReference(unionSchema)) {
        const refName = unionSchema.$ref.split('/').pop() || 'unknown';
        unionTypes.push(refName);
      } else {
        // For inline schemas, recursively map
        unionTypes.push(mapTypeToTypeScript(unionSchema, allSchemas, contextName));
      }
    }
    
    return unionTypes.join(' | ');
  }
  
  const typeName = schema.type;
  const format = schema.format;
  
  if (typeName === 'array' && schema.items) {
    const itemType = mapTypeToTypeScript(schema.items as Schema | Reference, allSchemas, contextName);
    return `${itemType}[]`;
  }
  
  if (typeName === 'object') {
    if (schema.properties) {
      // Generate inline interface for inline objects
      const properties: string[] = [];
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const fieldDef = propSchema as Schema | Reference;
        const tsType = mapTypeToTypeScript(fieldDef, allSchemas, propName);
        const optional = schema.required?.includes(propName) ? '' : '?';
        properties.push(`${propName}${optional}: ${tsType}`);
      }
      return `{ ${properties.join('; ')} }`;
    }
    return 'Record<string, unknown>';
  }
  
  const typeMap: Record<string, string> = {
    'string': 'string',
    'integer': 'number',
    'number': 'number',
    'boolean': 'boolean',
  };
  
  if (format === 'date-time' || format === 'date') {
    return 'string'; // Dates are typically strings in JSON
  }
  
  if (typeName === 'null') {
    return 'null';
  }
  
  return typeMap[typeName || ''] || 'unknown';
}
