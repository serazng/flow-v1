.PHONY: swagger run build migrate

# Generate Swagger documentation
swagger:
	@echo "Generating Swagger documentation..."
	@swag init -g cmd/server/main.go -o docs

# Run the server
run:
	@go run cmd/server/main.go

# Build the server
build:
	@go build -o bin/server cmd/server/main.go

# Run migrations (requires DATABASE_URL to be set)
migrate:
	@echo "Running migrations..."
	@if [ -f .env ]; then \
		export $$(grep -v '^#' .env | xargs) && \
		psql $$DATABASE_URL -f migrations/001_create_todos.sql && \
		psql $$DATABASE_URL -f migrations/002_add_due_date_priority.sql; \
	else \
		echo "Error: .env file not found. Please create it with DATABASE_URL"; \
		exit 1; \
	fi

# Run only the new migration
migrate-new:
	@echo "Running new migration..."
	@if [ -f .env ]; then \
		export $$(grep -v '^#' .env | xargs) && \
		psql $$DATABASE_URL -f migrations/002_add_due_date_priority.sql; \
	else \
		echo "Error: .env file not found. Please create it with DATABASE_URL"; \
		exit 1; \
	fi

# Install dependencies
deps:
	@go mod download
	@go mod tidy

# Install swag CLI tool
install-swagger:
	@go install github.com/swaggo/swag/cmd/swag@latest

