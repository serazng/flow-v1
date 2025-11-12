import { readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'js-yaml';
import { validateAndResolvePath, validatePathExists } from '../utils/path-utils.js';
import { validateSwaggerSpec } from '../utils/swagger-validator.js';
import { logger } from '../utils/logger.js';
import type { SwaggerSpec, Schema, Reference, Operation, Parameter, RequestBody } from '../types/swagger.js';
import { isReference, isRequestBodyReference } from '../types/swagger.js';

export async function generateBackend(swaggerPath: string, outputDir: string) {
  try {
    // Validate and resolve paths securely
    const fullPath = validateAndResolvePath(swaggerPath);
    await validatePathExists(fullPath);
    
    const outputPath = validateAndResolvePath(outputDir);
    
    logger.info(`Generating backend code from ${swaggerPath} to ${outputDir}`);
    
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
    
    // Get all schemas (support both OpenAPI 3.0 and Swagger 2.0)
    const allSchemas: Record<string, Schema | Reference> = {};
    if (spec.components?.schemas) {
      Object.assign(allSchemas, spec.components.schemas);
    }
    if (spec.definitions) {
      Object.assign(allSchemas, spec.definitions);
    }
    
    // Generate models from schemas
    if (Object.keys(allSchemas).length > 0) {
      const modelsDir = join(outputPath, 'internal', 'models');
      await mkdir(modelsDir, { recursive: true });
      
      const imports = new Set<string>();
      
      for (const [name, schema] of Object.entries(allSchemas)) {
        const { code, requiredImports } = generateGoModel(name, schema, allSchemas, spec);
        requiredImports.forEach(imp => imports.add(imp));
        await writeFile(join(modelsDir, `${name.toLowerCase()}.go`), code);
      }
      
      // Write a shared imports file if needed
      if (imports.size > 0) {
        logger.debug(`Required imports: ${Array.from(imports).join(', ')}`);
      }
    }
    
    // Generate handlers from paths
    const handlersDir = join(outputPath, 'internal', 'handlers');
    await mkdir(handlersDir, { recursive: true });
    
    // Try to read module name from go.mod
    let moduleName = 'flow-v1/backend'; // default
    try {
      const goModPath = join(outputPath, 'go.mod');
      const goModContent = await readFile(goModPath, 'utf-8');
      const moduleMatch = goModContent.match(/^module\s+(\S+)/m);
      if (moduleMatch) {
        moduleName = moduleMatch[1];
      }
    } catch {
      // If go.mod doesn't exist, use default
      logger.debug('Could not read go.mod, using default module name');
    }
    
    const handlerCode = generateGoHandlers(spec.paths, spec, allSchemas, moduleName);
    await writeFile(join(handlersDir, 'generated.go'), handlerCode);
    
    // Generate routes registration
    const routesDir = join(outputPath, 'internal', 'routes');
    await mkdir(routesDir, { recursive: true });
    
    const routesCode = generateGoRoutes(spec.paths, spec, moduleName);
    await writeFile(join(routesDir, 'generated.go'), routesCode);
    
    logger.info('Backend code generated successfully');
    
    return {
      content: [
        {
          type: 'text',
          text: `Backend code generated successfully in ${outputDir}\n- Handlers: internal/handlers/generated.go\n- Routes: internal/routes/generated.go\n\nTo use the generated routes, add this to main.go:\n  import "${moduleName}/internal/routes"\n  routes.RegisterGeneratedRoutes(v1)`,
        },
      ],
    };
  } catch (error) {
    logger.error(`Failed to generate backend code: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error: Failed to generate backend code: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Resolves a $ref reference to the actual schema
 */
function resolveReference(
  ref: string,
  spec: SwaggerSpec
): Schema | Reference | null {
  // Handle local references (starting with #)
  if (!ref.startsWith('#')) {
    logger.warn(`External references not supported: ${ref}`);
    return null;
  }
  
  // Remove the leading # and split by /
  const parts = ref.substring(1).split('/').filter(p => p.length > 0);
  
  if (parts.length === 0) {
    return null;
  }
  
  // Navigate through the spec object
  let current: any = spec;
  for (const part of parts) {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      // Check if the key exists (handles both regular keys and dotted keys like "models.Todo")
      if (part in current) {
        current = current[part];
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
  
  return current as Schema | Reference;
}

/**
 * Resolves allOf by merging all schemas' properties
 */
function resolveAllOf(
  allOf: Array<Schema | Reference>,
  spec: SwaggerSpec,
  allSchemas: Record<string, Schema | Reference>,
  visitedRefs: Set<string> = new Set()
): { properties: Record<string, Schema | Reference>; required: string[] } {
  const mergedProperties: Record<string, Schema | Reference> = {};
  const mergedRequired: string[] = [];
  
  for (const schemaItem of allOf) {
    let resolved = schemaItem;
    
    // Resolve reference if needed
    if (isReference(schemaItem)) {
      if (visitedRefs.has(schemaItem.$ref)) {
        logger.warn(`Circular reference in allOf: ${schemaItem.$ref}`);
        continue;
      }
      visitedRefs.add(schemaItem.$ref);
      const refResolved = resolveReference(schemaItem.$ref, spec);
      if (!refResolved || isReference(refResolved)) {
        continue;
      }
      resolved = refResolved;
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

function generateGoModel(
  name: string,
  schema: Schema | Reference,
  allSchemas: Record<string, Schema | Reference>,
  spec: SwaggerSpec,
  visitedRefs: Set<string> = new Set()
): { code: string; requiredImports: string[] } {
  const imports = new Set<string>();
  const fields: string[] = [];
  const constants: string[] = [];
  
  // Resolve reference if needed
  let resolvedSchema = schema;
  if (isReference(schema)) {
    // Check for circular references
    if (visitedRefs.has(schema.$ref)) {
      logger.warn(`Circular reference detected: ${schema.$ref}`);
      // Extract type name from $ref as fallback
      const refName = schema.$ref.split('/').pop() || name;
      const cleanName = refName.split('.').pop() || refName;
      return {
        code: `package models\n\n// ${name} - Circular reference to ${schema.$ref}\n// Using type name: ${cleanName}\ntype ${name} ${cleanName}\n`,
        requiredImports: []
      };
    }
    
    // Add current reference to visited set
    visitedRefs.add(schema.$ref);
    
    const resolved = resolveReference(schema.$ref, spec);
    if (!resolved) {
      logger.warn(`Could not resolve reference: ${schema.$ref}`);
      return {
        code: `package models\n\n// ${name} - Reference to ${schema.$ref}\n// ERROR: Could not resolve reference\n`,
        requiredImports: []
      };
    }
    resolvedSchema = resolved;
    
    // If the resolved schema is also a reference, resolve it recursively
    if (isReference(resolvedSchema)) {
      return generateGoModel(name, resolvedSchema, allSchemas, spec, visitedRefs);
    }
  }
  
  // Now we have a resolved schema (not a reference)
  if (!isReference(resolvedSchema)) {
    // Handle enum - generate constants and custom type
    if (resolvedSchema.enum && Array.isArray(resolvedSchema.enum) && resolvedSchema.enum.length > 0) {
      const enumType = resolvedSchema.type === 'integer' ? 'int' : 'string';
      const enumName = name;
      
      // Generate constants
      resolvedSchema.enum.forEach((enumValue, index) => {
        const constName = `${enumName}${capitalize(String(enumValue).replace(/[^a-zA-Z0-9]/g, '_'))}`;
        const value = typeof enumValue === 'string' ? `"${enumValue}"` : String(enumValue);
        constants.push(`\t${constName} ${enumName} = ${value}`);
      });
      
      const code = `package models

// ${enumName} represents an enum type
type ${enumName} ${enumType}

const (
${constants.join('\n')}
)
`;
      return { code, requiredImports: [] };
    }
    
    // Handle allOf - merge all schemas
    if (resolvedSchema.allOf && Array.isArray(resolvedSchema.allOf) && resolvedSchema.allOf.length > 0) {
      const merged = resolveAllOf(resolvedSchema.allOf, spec, allSchemas, visitedRefs);
      
      // Generate fields from merged properties
      for (const [fieldName, fieldSchema] of Object.entries(merged.properties)) {
        const fieldDef = fieldSchema as Schema | Reference;
        const { goType, import: requiredImport } = mapTypeToGo(fieldDef, allSchemas, spec, new Set());
        
        if (requiredImport) {
          imports.add(requiredImport);
        }
        
        const jsonTag = fieldName;
        const dbTag = fieldName;
        const omitempty = merged.required.includes(fieldName) ? '' : ',omitempty';
        fields.push(`\t${capitalize(fieldName)} ${goType} \`json:"${jsonTag}${omitempty}" db:"${dbTag}"\``);
      }
    }
    // Handle oneOf/anyOf - generate interface (Go doesn't have union types)
    else if ((resolvedSchema.oneOf || resolvedSchema.anyOf) && 
             Array.isArray(resolvedSchema.oneOf || resolvedSchema.anyOf) && 
             (resolvedSchema.oneOf || resolvedSchema.anyOf)!.length > 0) {
      const unionSchemas = resolvedSchema.oneOf || resolvedSchema.anyOf!;
      const typeNames: string[] = [];
      
      for (const unionSchema of unionSchemas) {
        if (isReference(unionSchema)) {
          const refName = unionSchema.$ref.split('/').pop() || 'Unknown';
          const cleanName = refName.split('.').pop() || refName;
          typeNames.push(cleanName);
        } else {
          // For inline schemas in oneOf/anyOf, we'd need to generate a type
          // For now, use a generic approach
          typeNames.push('interface{}');
        }
      }
      
      // Generate an interface that all union types should implement
      const code = `package models

// ${name} represents a union type (oneOf/anyOf)
// Go doesn't support union types natively. Consider using an interface or separate types.
// Possible types: ${typeNames.join(', ')}
type ${name} interface{}
`;
      return { code, requiredImports: [] };
    }
    // Handle regular object with properties
    else if (resolvedSchema.properties) {
      for (const [fieldName, fieldSchema] of Object.entries(resolvedSchema.properties)) {
        const fieldDef = fieldSchema as Schema | Reference;
        const { goType, import: requiredImport } = mapTypeToGo(fieldDef, allSchemas, spec, new Set());
        
        if (requiredImport) {
          imports.add(requiredImport);
        }
        
        const jsonTag = fieldName;
        const dbTag = fieldName;
        const omitempty = resolvedSchema.required?.includes(fieldName) ? '' : ',omitempty';
        fields.push(`\t${capitalize(fieldName)} ${goType} \`json:"${jsonTag}${omitempty}" db:"${dbTag}"\``);
      }
    }
  }
  
  // Generate imports section if needed
  let importsCode = '';
  if (imports.size > 0) {
    importsCode = `import (\n${Array.from(imports).map(imp => `\t"${imp}"`).join('\n')}\n)\n\n`;
  }
  
  // At this point, resolvedSchema should not be a reference (handled above)
  const description = !isReference(resolvedSchema) 
    ? (resolvedSchema.description || name)
    : name;
  
  const code = `${importsCode}package models

// ${name} represents ${description}
type ${name} struct {
${fields.length > 0 ? fields.join('\n') : '\t// No fields defined'}
}
`;
  
  return { code, requiredImports: Array.from(imports) };
}

function generateGoHandlers(
  paths: Record<string, any>, 
  spec: SwaggerSpec,
  allSchemas: Record<string, Schema | Reference>,
  moduleName: string
): string {
  const handlers: string[] = [];
  const imports = new Set<string>(['net/http', 'github.com/gin-gonic/gin']);
  const usedModels = new Set<string>();
  
  for (const [path, pathItem] of Object.entries(paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
    
    for (const method of methods) {
      const operation = pathItem[method] as Operation | undefined;
      if (operation) {
        const handler = generateGoHandler(operation, method.toUpperCase(), path, spec, allSchemas, usedModels);
        handlers.push(handler.code);
        handler.imports.forEach(imp => imports.add(imp));
      }
    }
  }
  
  // Add models import if any models are used
  if (usedModels.size > 0) {
    imports.add(`${moduleName}/internal/models`);
  }
  
  const importsCode = `import (
${Array.from(imports).map(imp => `\t"${imp}"`).join('\n')}
)

`;
  
  return `${importsCode}package handlers

${handlers.join('\n\n')}
`;
}

/**
 * Extracts the request body schema from an operation
 * Supports both Swagger 2.0 (body parameters) and OpenAPI 3.0 (requestBody)
 */
function extractRequestBodySchema(
  operation: Operation,
  spec: SwaggerSpec
): Schema | Reference | null {
  // OpenAPI 3.0: Check requestBody
  if (operation.requestBody) {
    let requestBody: RequestBody;
    
    // Resolve reference if needed
    if (isRequestBodyReference(operation.requestBody)) {
      const resolved = resolveReference(operation.requestBody.$ref, spec);
      // Check if resolved is a RequestBody (has 'content' property)
      if (!resolved || isReference(resolved) || !('content' in resolved)) {
        logger.warn(`Could not resolve requestBody reference: ${operation.requestBody.$ref}`);
        return null;
      }
      requestBody = resolved as RequestBody;
    } else {
      requestBody = operation.requestBody;
    }
    
    // Get schema from content (typically application/json)
    const jsonContent = requestBody.content?.['application/json'];
    if (jsonContent?.schema) {
      return jsonContent.schema;
    }
    
    // Fallback: try any content type
    const firstContent = Object.values(requestBody.content || {})[0];
    if (firstContent?.schema) {
      return firstContent.schema;
    }
  }
  
  // Swagger 2.0: Check for body parameter
  const bodyParam = (operation.parameters || []).find(p => p.in === 'body');
  if (bodyParam?.schema) {
    return bodyParam.schema;
  }
  
  return null;
}

/**
 * Generates a Go type name from a schema reference or inline schema
 */
function getGoTypeNameFromSchema(
  schema: Schema | Reference,
  spec: SwaggerSpec,
  operationId: string
): string {
  // If it's a reference, extract the type name
  if (isReference(schema)) {
    const refName = schema.$ref.split('/').pop() || '';
    // Clean up the name (remove dots, handle namespaced types)
    const cleanName = refName.split('.').pop() || refName;
    return cleanName || 'Request';
  }
  
  // For inline schemas, generate a name based on operation
  // Capitalize first letter and add "Request" suffix
  const baseName = operationId.charAt(0).toUpperCase() + operationId.slice(1);
  return `${baseName}Request`;
}

function generateGoHandler(
  operation: Operation,
  method: string,
  path: string,
  spec: SwaggerSpec,
  allSchemas: Record<string, Schema | Reference>,
  usedModels: Set<string>
): { code: string; imports: string[] } {
  const imports = new Set<string>();
  
  // Generate operationId if missing
  const operationId = operation.operationId || generateHandlerName(method.toLowerCase(), path);
  const summary = operation.summary || operationId;
  const description = operation.description || '';
  
  // Extract path parameters
  const pathParams = (operation.parameters || []).filter(p => p.in === 'path');
  const queryParams = (operation.parameters || []).filter(p => p.in === 'query');
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
  
  // Generate request struct if needed
  let requestStruct = '';
  let requestBinding = '';
  
  // Check for body parameters (Swagger 2.0) or requestBody (OpenAPI 3.0)
  const hasBodyParam = (operation.parameters || []).some(p => p.in === 'body');
  if (hasBody && (operation.requestBody || hasBodyParam)) {
    const bodySchema = extractRequestBodySchema(operation, spec);
    
    if (bodySchema) {
      // Check if it's a reference to an existing model
      if (isReference(bodySchema)) {
        // Extract the model name from the reference
        const refPath = bodySchema.$ref.substring(1); // Remove leading #
        const refParts = refPath.split('/').filter(p => p.length > 0);
        const refKey = refParts[refParts.length - 1] || ''; // Last part is the key
        const cleanName = refKey.split('.').pop() || refKey; // Remove namespace if present
        
        // Check if this model exists in allSchemas (try both full key and clean name)
        const isModel = allSchemas[refKey] !== undefined || 
                       (refKey !== cleanName && allSchemas[cleanName] !== undefined);
        
        if (isModel) {
          // It's a model, use models. prefix and track it
          usedModels.add(cleanName);
          requestStruct = `\tvar req models.${cleanName}\n`;
          requestBinding = `\tif err := c.ShouldBindJSON(&req); err != nil {\n\t\tc.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})\n\t\treturn\n\t}\n`;
          imports.add('net/http');
        } else {
          // Not a known model, use directly
          requestStruct = `\tvar req ${cleanName}\n`;
          requestBinding = `\tif err := c.ShouldBindJSON(&req); err != nil {\n\t\tc.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})\n\t\treturn\n\t}\n`;
          imports.add('net/http');
        }
      } else {
        // For inline schemas, we'd need to generate a struct
        // For now, use a generic approach
        const typeName = getGoTypeNameFromSchema(bodySchema, spec, operationId);
        requestStruct = `\tvar req ${typeName}\n`;
        requestBinding = `\tif err := c.ShouldBindJSON(&req); err != nil {\n\t\tc.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})\n\t\treturn\n\t}\n`;
        imports.add('net/http');
      }
    }
  }
  
  // Generate parameter extraction
  const paramExtraction: string[] = [];
  pathParams.forEach(param => {
    paramExtraction.push(`\t${param.name} := c.Param("${param.name}")`);
  });
  
  queryParams.forEach(param => {
    const paramType = param.schema && !isReference(param.schema) && param.schema.type === 'integer'
      ? 'QueryInt'
      : 'Query';
    paramExtraction.push(`\t${param.name} := c.${paramType}("${param.name}")`);
  });
  
  const handlerCode = `// ${operationId} handles ${method} ${path}
// ${summary}
// ${description}
func ${operationId}(c *gin.Context) {
${paramExtraction.length > 0 ? paramExtraction.join('\n') + '\n' : ''}${requestStruct}${requestBinding}\t// TODO: Implement handler logic
\tc.JSON(http.StatusOK, gin.H{"message": "Not implemented"})
}`;
  
  return { code: handlerCode, imports: Array.from(imports) };
}

/**
 * Generates a unique name for an inline schema based on context
 */
function generateInlineTypeName(context: string, counter: number = 0): string {
  const sanitized = context
    .replace(/[^a-zA-Z0-9]/g, '')
    .split(/(?=[A-Z])/)
    .map(s => capitalize(s.toLowerCase()))
    .join('');
  return counter > 0 ? `${sanitized}${counter}` : sanitized;
}

function mapTypeToGo(
  schema: Schema | Reference,
  allSchemas: Record<string, Schema | Reference>,
  spec: SwaggerSpec,
  visitedRefs: Set<string> = new Set(),
  contextName: string = 'Inline'
): { goType: string; import?: string; inlineType?: { name: string; code: string } } {
  if (isReference(schema)) {
    // Check for circular references
    if (visitedRefs.has(schema.$ref)) {
      logger.warn(`Circular reference detected in type mapping: ${schema.$ref}`);
      // Extract type name from $ref as fallback
      const refName = schema.$ref.split('/').pop() || 'interface{}';
      const cleanName = refName.split('.').pop() || refName;
      return { goType: cleanName };
    }
    
    // Add current reference to visited set
    visitedRefs.add(schema.$ref);
    
    // Resolve the reference
    const resolved = resolveReference(schema.$ref, spec);
    if (resolved && !isReference(resolved)) {
      // If it resolves to a concrete schema, recursively map it
      return mapTypeToGo(resolved, allSchemas, spec, visitedRefs, contextName);
    }
    // Extract type name from $ref as fallback
    const refName = schema.$ref.split('/').pop() || 'interface{}';
    // Clean up the name (remove dots, etc.)
    const cleanName = refName.split('.').pop() || refName;
    return { goType: cleanName };
  }
  
  // Handle enum
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
    // For enums, we expect them to be defined as models, so extract the type
    // If it's an inline enum, we'd need to generate it, but for now return string/int
    const enumType = schema.type === 'integer' ? 'int' : 'string';
    return { goType: enumType };
  }
  
  // Handle allOf - merge properties and generate inline type if needed
  if (schema.allOf && Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const merged = resolveAllOf(schema.allOf, spec, allSchemas, visitedRefs);
    // For inline allOf, generate a struct type
    const inlineName = generateInlineTypeName(contextName);
    const fields: string[] = [];
    const imports = new Set<string>();
    
    for (const [fieldName, fieldSchema] of Object.entries(merged.properties)) {
      const fieldDef = fieldSchema as Schema | Reference;
      const { goType, import: requiredImport } = mapTypeToGo(fieldDef, allSchemas, spec, new Set(), fieldName);
      
      if (requiredImport) {
        imports.add(requiredImport);
      }
      
      const omitempty = merged.required.includes(fieldName) ? '' : ',omitempty';
      fields.push(`\t${capitalize(fieldName)} ${goType} \`json:"${fieldName}${omitempty}"\``);
    }
    
    const importsCode = imports.size > 0 
      ? `import (\n${Array.from(imports).map(imp => `\t"${imp}"`).join('\n')}\n)\n\n`
      : '';
    
    const inlineCode = `${importsCode}type ${inlineName} struct {
${fields.length > 0 ? fields.join('\n') : '\t// No fields'}
}`;
    
    return { goType: inlineName, inlineType: { name: inlineName, code: inlineCode } };
  }
  
  // Handle oneOf/anyOf - return interface{} for now
  if ((schema.oneOf || schema.anyOf) && 
      Array.isArray(schema.oneOf || schema.anyOf) && 
      (schema.oneOf || schema.anyOf)!.length > 0) {
    return { goType: 'interface{}' };
  }
  
  const typeName = schema.type;
  const format = schema.format;
  
  if (typeName === 'array' && schema.items) {
    const itemType = mapTypeToGo(schema.items as Schema | Reference, allSchemas, spec, visitedRefs, contextName);
    return { goType: `[]${itemType.goType}`, import: itemType.import, inlineType: itemType.inlineType };
  }
  
  if (typeName === 'object') {
    if (schema.properties) {
      // Generate inline struct for inline objects
      const inlineName = generateInlineTypeName(contextName);
      const fields: string[] = [];
      const imports = new Set<string>();
      
      for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
        const fieldDef = fieldSchema as Schema | Reference;
        const { goType, import: requiredImport, inlineType } = mapTypeToGo(fieldDef, allSchemas, spec, new Set(), fieldName);
        
        if (requiredImport) {
          imports.add(requiredImport);
        }
        
        // Note: inline types from nested objects would need to be collected separately
        const omitempty = schema.required?.includes(fieldName) ? '' : ',omitempty';
        fields.push(`\t${capitalize(fieldName)} ${goType} \`json:"${fieldName}${omitempty}"\``);
      }
      
      const importsCode = imports.size > 0 
        ? `import (\n${Array.from(imports).map(imp => `\t"${imp}"`).join('\n')}\n)\n\n`
        : '';
      
      const inlineCode = `${importsCode}type ${inlineName} struct {
${fields.length > 0 ? fields.join('\n') : '\t// No fields'}
}`;
      
      return { goType: inlineName, inlineType: { name: inlineName, code: inlineCode } };
    }
    // Empty object or object without properties
    return { goType: 'map[string]interface{}' };
  }
  
  const typeMap: Record<string, { goType: string; import?: string }> = {
    'string': { goType: 'string' },
    'integer': format === 'int64' ? { goType: 'int64' } : { goType: 'int' },
    'number': format === 'float32' ? { goType: 'float32' } : { goType: 'float64' },
    'boolean': { goType: 'bool' },
  };
  
  if (format === 'date-time' || format === 'date') {
    return { goType: 'time.Time', import: 'time' };
  }
  
  return typeMap[typeName || ''] || { goType: 'interface{}' };
}

/**
 * Generates a handler function name from method and path
 */
function generateHandlerName(method: string, path: string): string {
  // Remove leading/trailing slashes and split
  const parts = path.replace(/^\/+|\/+$/g, '').split('/');
  
  // Remove path parameters (e.g., {id} or :id)
  const cleanParts = parts
    .filter(p => p && !p.startsWith('{') && !p.startsWith(':'))
    .map(p => capitalize(p));
  
  // Generate name: Method + PathParts (e.g., GetTodos, CreateTodo, GetTodo)
  const methodName = capitalize(method.toLowerCase());
  const pathName = cleanParts.length > 0 
    ? cleanParts.map(capitalize).join('')
    : 'Item';
  
  // Special handling for common patterns
  if (parts.some(p => p.startsWith('{') || p.startsWith(':'))) {
    // Has path param, singularize last part
    if (cleanParts.length > 0) {
      const lastPart = cleanParts[cleanParts.length - 1];
      const singular = lastPart.endsWith('s') ? lastPart.slice(0, -1) : lastPart;
      return `${methodName}${singular}`;
    }
    return `${methodName}Item`;
  }
  
  // Plural path (e.g., /todos -> GetTodos)
  return `${methodName}${pathName}`;
}

/**
 * Generates route registration code from Swagger paths
 */
function generateGoRoutes(
  paths: Record<string, any>,
  spec: SwaggerSpec,
  moduleName: string
): string {
  const imports = new Set<string>(['github.com/gin-gonic/gin', `${moduleName}/internal/handlers`]);
  
  // Group routes by path prefix (e.g., /todos, /todos/{id} -> todos group)
  const pathGroups: Record<string, Array<{ method: string; relativePath: string; handler: string }>> = {};
  
  for (const [path, pathItem] of Object.entries(paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
    
    for (const method of methods) {
      const operation = pathItem[method] as Operation | undefined;
      if (operation) {
        // Generate or use operationId
        const operationId = operation.operationId || generateHandlerName(method, path);
        
        // Extract base path prefix (e.g., /todos/{id} -> todos)
        const pathParts = path.split('/').filter(p => p && !p.startsWith('{'));
        const basePathKey = pathParts.length > 0 ? pathParts[0] : 'root';
        
        if (!pathGroups[basePathKey]) {
          pathGroups[basePathKey] = [];
        }
        
        // Convert Swagger path to Gin path (e.g., /todos/{id} -> /todos/:id)
        const ginPath = path.replace(/\{(\w+)\}/g, ':$1');
        
        // Get relative path for the route (remove base prefix)
        // e.g., /todos -> '', /todos/:id -> /:id
        let relativePath = '';
        if (ginPath === `/${basePathKey}`) {
          relativePath = '';
        } else if (ginPath.startsWith(`/${basePathKey}/`)) {
          relativePath = ginPath.substring(basePathKey.length + 1); // Keep the leading /
        } else if (ginPath.startsWith(`/${basePathKey}`)) {
          relativePath = ginPath.substring(basePathKey.length);
        } else {
          relativePath = ginPath;
        }
        
        pathGroups[basePathKey].push({
          method: method.toUpperCase(),
          relativePath: relativePath,
          handler: operationId
        });
      }
    }
  }
  
  // Generate route registration code
  const routeGroups: string[] = [];
  
  for (const [pathPrefix, routes] of Object.entries(pathGroups)) {
    const groupName = pathPrefix === 'root' ? 'api' : pathPrefix;
    const groupPath = pathPrefix === 'root' ? '' : `/${pathPrefix}`;
    
    const routeRegistrations: string[] = [];
    for (const route of routes) {
      // Use the relative path as-is
      routeRegistrations.push(`\t\t${groupName}.${route.method}("${route.relativePath}", handlers.${route.handler})`);
    }
    
    routeGroups.push(`\t${groupName} := v1.Group("${groupPath}")
\t{
${routeRegistrations.join('\n')}
\t}`);
  }
  
  const importsCode = `import (
${Array.from(imports).map(imp => `\t"${imp}"`).join('\n')}
)

`;
  
  return `${importsCode}package routes

// RegisterGeneratedRoutes registers all generated routes from Swagger spec
// This function should be called from main.go after creating the router
// Example: routes.RegisterGeneratedRoutes(v1) where v1 is *gin.RouterGroup for /api/v1
func RegisterGeneratedRoutes(v1 *gin.RouterGroup) {
${routeGroups.length > 0 ? routeGroups.join('\n\n') : '\t// No routes to register'}
}
`;
}

function capitalize(str: string): string {
  if (str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}
