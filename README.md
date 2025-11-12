# flow-v1

A Todo application with Go backend, React + TypeScript frontend, PostgreSQL database, and MCP server for Swagger-based code generation.

## Architecture

```
React (Vite)  ←→  Go API (Gin)  ←→  PostgreSQL (Supabase)
                        ↑
                MCP Server reads/generates
                        ↓
                Swagger/OpenAPI (auto-gen)
```

**Backend**: Go, Gin, pgx/v5, Swagger (swaggo/swag)

**Frontend**: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui

**MCP Server**: TypeScript, Model Context Protocol SDK

## Quick Start

### Prerequisites
- Go 1.21+, Node.js 18+, PostgreSQL (Supabase), Swag CLI

### Environment Variables

**Backend** (`.env`):
```bash
DATABASE_URL=postgresql://user:pass@host:port/dbname
PORT=8080
```

### Setup

**Backend**:
```bash
cd backend && go mod download
make migrate && make swagger && make run
```

**Frontend**:
```bash
cd frontend && npm install && npm run dev
```

**MCP Server**:
```bash
cd mcp-server && npm install && npm start
```

## API Endpoints

**Swagger UI**: `http://localhost:8080/swagger/index.html`

## Project Structure

```
backend/          # Go API (handlers, models, migrations, docs)
frontend/         # React app (components, services, types)
mcp-server/       # MCP server (tools, utils)
agents/           # Development instructions
```