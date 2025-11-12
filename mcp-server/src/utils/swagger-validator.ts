import { SwaggerSpec } from '../types/swagger.js';
import { logger } from './logger.js';

/**
 * Validate basic structure of Swagger/OpenAPI spec
 */
export function validateSwaggerSpec(spec: unknown): spec is SwaggerSpec {
  if (!spec || typeof spec !== 'object') {
    throw new Error('Swagger spec must be an object');
  }

  const s = spec as Record<string, unknown>;

  // Check for OpenAPI or Swagger version
  if (!s.openapi && !s.swagger) {
    throw new Error('Swagger spec must have either "openapi" or "swagger" field');
  }

  // Validate info section
  if (!s.info || typeof s.info !== 'object') {
    throw new Error('Swagger spec must have an "info" object');
  }

  const info = s.info as Record<string, unknown>;
  if (typeof info.title !== 'string') {
    throw new Error('Swagger spec info must have a "title" string');
  }
  if (typeof info.version !== 'string') {
    throw new Error('Swagger spec info must have a "version" string');
  }

  // Validate paths
  if (!s.paths || typeof s.paths !== 'object') {
    throw new Error('Swagger spec must have a "paths" object');
  }

  logger.debug('Swagger spec validation passed');
  return true;
}

/**
 * Check if spec is OpenAPI 3.x
 */
export function isOpenAPI3(spec: SwaggerSpec): boolean {
  if (spec.openapi) {
    const version = parseFloat(spec.openapi);
    return version >= 3.0 && version < 4.0;
  }
  return false;
}

/**
 * Check if spec is Swagger 2.0
 */
export function isSwagger2(spec: SwaggerSpec): boolean {
  return spec.swagger === '2.0';
}

