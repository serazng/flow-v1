import { generateBackend } from './backend-generator.js';
import { generateFrontend } from './frontend-generator.js';
import { logger } from '../utils/logger.js';

export async function generateFeature(
  swaggerPath: string,
  backendDir: string,
  frontendDir: string
) {
  try {
    logger.info(`Generating complete feature: backend=${backendDir}, frontend=${frontendDir}`);
    
    const backendResult = await generateBackend(swaggerPath, backendDir);
    if (backendResult.isError) {
      return backendResult;
    }
    
    const frontendResult = await generateFrontend(swaggerPath, frontendDir);
    if (frontendResult.isError) {
      return frontendResult;
    }
    
    logger.info('Feature generation complete');
    
    return {
      content: [
        {
          type: 'text',
          text: `Feature generation complete!\n\nBackend: ${backendResult.content[0].text}\nFrontend: ${frontendResult.content[0].text}`,
        },
      ],
    };
  } catch (error) {
    logger.error(`Failed to generate feature: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error: Failed to generate feature: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

