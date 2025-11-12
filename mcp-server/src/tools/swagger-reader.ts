import { readFile } from 'fs/promises';
import yaml from 'js-yaml';
import { validateAndResolvePath, validatePathExists } from '../utils/path-utils.js';
import { validateSwaggerSpec } from '../utils/swagger-validator.js';
import { logger } from '../utils/logger.js';
import type { SwaggerSpec } from '../types/swagger.js';

export async function readSwagger(filePath: string) {
  try {
    // Validate and resolve path securely
    const fullPath = validateAndResolvePath(filePath);
    await validatePathExists(fullPath);
    
    logger.debug(`Reading Swagger file: ${fullPath}`);
    const content = await readFile(fullPath, 'utf-8');
    
    let parsed: unknown;
    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      parsed = yaml.load(content);
    } else {
      parsed = JSON.parse(content);
    }
    
    // Validate the parsed spec
    validateSwaggerSpec(parsed);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(parsed, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error(`Failed to read Swagger file: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error: Failed to read Swagger file: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

