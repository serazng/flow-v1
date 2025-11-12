import { resolve, normalize, relative, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { access } from 'fs/promises';
import { constants } from 'fs';

/**
 * Get the workspace root directory
 * Works by detecting the directory containing backend/, frontend/, and mcp-server/
 */
export function getWorkspaceRoot(): string {
  // Try environment variable first
  const envRoot = process.env.MCP_WORKSPACE_ROOT;
  if (envRoot) {
    return resolve(envRoot);
  }

  // Get the directory of the current file (mcp-server/src/utils/path-utils.ts)
  // Then go up to workspace root (mcp-server/src/utils -> mcp-server/src -> mcp-server -> workspace)
  const currentFile = fileURLToPath(import.meta.url);
  const utilsDir = dirname(currentFile);
  const srcDir = dirname(utilsDir);
  const mcpServerDir = dirname(srcDir);
  const workspaceRoot = dirname(mcpServerDir);

  return resolve(workspaceRoot);
}

/**
 * Validate and resolve a path relative to workspace root
 * Prevents directory traversal attacks
 * Handles both absolute and relative paths
 * 
 * @param inputPath - Path (absolute or relative to workspace root)
 * @returns Resolved absolute path
 * @throws Error if path is outside workspace or invalid
 */
export function validateAndResolvePath(inputPath: string): string {
  const workspaceRoot = getWorkspaceRoot();
  
  // Normalize both paths for comparison (handle trailing slashes, etc.)
  const normalizedRoot = resolve(workspaceRoot);
  
  let normalizedFull: string;
  
  // Check if the path is already absolute
  if (isAbsolute(inputPath)) {
    // Path is absolute - normalize it and validate it's within workspace
    normalizedFull = resolve(normalize(inputPath));
  } else {
    // Path is relative - resolve it against workspace root
    const normalized = normalize(inputPath);
    
    // Remove leading slashes to make it relative
    const cleanPath = normalized.replace(/^\/+/, '');
    
    // Resolve against workspace root
    normalizedFull = resolve(workspaceRoot, cleanPath);
  }
  
  // Ensure the resolved path is within workspace root
  const relativeToRoot = relative(normalizedRoot, normalizedFull);
  
  // Check for directory traversal attempts
  // If relative path starts with .. or contains .., it's outside the root
  if (relativeToRoot.startsWith('..') || relativeToRoot.includes('..')) {
    throw new Error(`Path traversal detected: ${inputPath} resolves outside workspace`);
  }
  
  // Additional check: ensure the full path starts with the workspace root
  // Use normalized paths for cross-platform compatibility
  if (!normalizedFull.startsWith(normalizedRoot + '/') && normalizedFull !== normalizedRoot) {
    throw new Error(`Path outside workspace: ${inputPath}`);
  }
  
  return normalizedFull;
}

/**
 * Validate that a path exists and is readable
 */
export async function validatePathExists(filePath: string): Promise<void> {
  try {
    await access(filePath, constants.F_OK | constants.R_OK);
  } catch (error) {
    throw new Error(`Path does not exist or is not readable: ${filePath}`);
  }
}

/**
 * Validate that a directory exists and is writable
 */
export async function validateDirectoryWritable(dirPath: string): Promise<void> {
  try {
    await access(dirPath, constants.F_OK | constants.W_OK);
  } catch (error) {
    throw new Error(`Directory does not exist or is not writable: ${dirPath}`);
  }
}

