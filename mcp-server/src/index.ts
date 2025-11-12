#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readSwagger } from './tools/swagger-reader.js';
import { generateBackend } from './tools/backend-generator.js';
import { generateFrontend } from './tools/frontend-generator.js';
import { generateFeature } from './tools/feature-generator.js';
import { validateAndResolvePath, validatePathExists, getWorkspaceRoot } from './utils/path-utils.js';
import { logger } from './utils/logger.js';
import { readdir } from 'fs/promises';
import { join, relative } from 'path';

const server = new Server(
  {
    name: 'swagger-codegen-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'read_swagger',
      description: 'Read and parse a Swagger/OpenAPI file',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Path to the Swagger file (YAML or JSON)',
          },
        },
        required: ['filePath'],
      },
    },
    {
      name: 'generate_backend',
      description: 'Generate Go backend code (handlers, models, routes) from Swagger',
      inputSchema: {
        type: 'object',
        properties: {
          swaggerPath: {
            type: 'string',
            description: 'Path to the Swagger file',
          },
          outputDir: {
            type: 'string',
            description: 'Output directory for generated code',
          },
        },
        required: ['swaggerPath', 'outputDir'],
      },
    },
    {
      name: 'generate_frontend',
      description: 'Generate React/TypeScript frontend code (API client, types, components) from Swagger',
      inputSchema: {
        type: 'object',
        properties: {
          swaggerPath: {
            type: 'string',
            description: 'Path to the Swagger file',
          },
          outputDir: {
            type: 'string',
            description: 'Output directory for generated code',
          },
        },
        required: ['swaggerPath', 'outputDir'],
      },
    },
    {
      name: 'generate_feature',
      description: 'Generate complete feature (backend + frontend) from Swagger',
      inputSchema: {
        type: 'object',
        properties: {
          swaggerPath: {
            type: 'string',
            description: 'Path to the Swagger file',
          },
          backendDir: {
            type: 'string',
            description: 'Backend output directory',
          },
          frontendDir: {
            type: 'string',
            description: 'Frontend output directory',
          },
        },
        required: ['swaggerPath', 'backendDir', 'frontendDir'],
      },
    },
  ],
}));

/**
 * Recursively discover Swagger/OpenAPI files in the workspace
 */
async function discoverSwaggerFiles(): Promise<Array<{ uri: string; filePath: string; mimeType: string }>> {
  const workspaceRoot = getWorkspaceRoot();
  const swaggerFiles: Array<{ uri: string; filePath: string; mimeType: string }> = [];
  
  async function scanDirectory(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        // Skip node_modules and other common directories
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'build') {
            continue;
          }
          await scanDirectory(fullPath);
        } else if (entry.isFile()) {
          const lowerName = entry.name.toLowerCase();
          // Check for swagger/openapi files
          if (
            lowerName.endsWith('.yaml') || 
            lowerName.endsWith('.yml') || 
            lowerName.endsWith('.json')
          ) {
            // Check if filename suggests it's a swagger/openapi file
            if (
              lowerName.includes('swagger') || 
              lowerName.includes('openapi') ||
              lowerName === 'swagger.yaml' ||
              lowerName === 'swagger.yml' ||
              lowerName === 'swagger.json' ||
              lowerName === 'openapi.yaml' ||
              lowerName === 'openapi.yml' ||
              lowerName === 'openapi.json'
            ) {
              const relativePath = relative(workspaceRoot, fullPath);
              // Encode the file path in the URI using URL encoding
              const encodedPath = encodeURIComponent(relativePath);
              const uri = `swagger://${encodedPath}`;
              
              const mimeType = lowerName.endsWith('.json') 
                ? 'application/json' 
                : 'application/yaml';
              
              swaggerFiles.push({ uri, filePath: relativePath, mimeType });
            }
          }
        }
      }
    } catch (error) {
      logger.debug(`Could not scan directory ${dir}: ${error}`);
    }
  }
  
  await scanDirectory(workspaceRoot);
  return swaggerFiles;
}

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  try {
    const swaggerFiles = await discoverSwaggerFiles();
    
    const resources = swaggerFiles.map(({ uri, filePath, mimeType }) => ({
      uri,
      name: `Swagger: ${filePath}`,
      description: `Swagger/OpenAPI documentation file at ${filePath}`,
      mimeType,
    }));
    
    return { resources };
  } catch (error) {
    logger.error(`Failed to discover swagger files: ${error}`);
    return { resources: [] };
  }
});

// Handle resource reading
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  
  try {
    if (uri.startsWith('swagger://')) {
      // Parse URI properly - decode the file path from the URI
      const encodedPath = uri.replace(/^swagger:\/\//, '');
      const filePath = decodeURIComponent(encodedPath);
      
      // Validate and resolve path securely
      const fullPath = validateAndResolvePath(filePath);
      await validatePathExists(fullPath);
      
      const fs = await import('fs/promises');
      const content = await fs.readFile(fullPath, 'utf-8');
      
      logger.debug(`Reading resource: ${uri} -> ${filePath} -> ${fullPath}`);
      
      // Determine mime type from file extension
      const mimeType = filePath.endsWith('.json') 
        ? 'application/json' 
        : 'application/yaml';
      
      return {
        contents: [
          {
            uri,
            mimeType,
            text: content,
          },
        ],
      };
    }
    
    // Return proper error response instead of throwing
    return {
      contents: [],
      isError: true,
    };
  } catch (error) {
    logger.error(`Failed to read resource ${uri}: ${error}`);
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Validate arguments exist
    if (!args) {
      throw new Error('Missing arguments');
    }

    logger.debug(`Calling tool: ${name}`, args);

    switch (name) {
      case 'read_swagger':
        if (!args.filePath || typeof args.filePath !== 'string') {
          throw new Error('filePath argument is required and must be a string');
        }
        return await readSwagger(args.filePath);
      
      case 'generate_backend':
        if (!args.swaggerPath || typeof args.swaggerPath !== 'string') {
          throw new Error('swaggerPath argument is required and must be a string');
        }
        if (!args.outputDir || typeof args.outputDir !== 'string') {
          throw new Error('outputDir argument is required and must be a string');
        }
        return await generateBackend(args.swaggerPath, args.outputDir);
      
      case 'generate_frontend':
        if (!args.swaggerPath || typeof args.swaggerPath !== 'string') {
          throw new Error('swaggerPath argument is required and must be a string');
        }
        if (!args.outputDir || typeof args.outputDir !== 'string') {
          throw new Error('outputDir argument is required and must be a string');
        }
        return await generateFrontend(args.swaggerPath, args.outputDir);
      
      case 'generate_feature':
        if (!args.swaggerPath || typeof args.swaggerPath !== 'string') {
          throw new Error('swaggerPath argument is required and must be a string');
        }
        if (!args.backendDir || typeof args.backendDir !== 'string') {
          throw new Error('backendDir argument is required and must be a string');
        }
        if (!args.frontendDir || typeof args.frontendDir !== 'string') {
          throw new Error('frontendDir argument is required and must be a string');
        }
        return await generateFeature(args.swaggerPath, args.backendDir, args.frontendDir);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error(`Tool ${name} failed: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Swagger CodeGen MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});

