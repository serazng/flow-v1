package handlers

import (
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"flow-v1/backend/internal/db"
	"flow-v1/backend/internal/models"
)

// GetTodos godoc
// @Summary      List all todos
// @Description  Get a list of all todo items with optional sorting and status filtering
// @Tags         todos
// @Accept       json
// @Produce      json
// @Param        sort_by         query     string  false  "Sort by field (due_date, priority, created_at)"  default(created_at)
// @Param        order           query     string  false  "Sort order (asc, desc)"  default(desc)
// @Param        status          query     string  false  "Filter by status (todo, in_progress, done)"
// @Param        story_points_min  query     int     false  "Minimum story points for filtering"
// @Param        story_points_max  query     int     false  "Maximum story points for filtering"
// @Success      200      {array}   models.Todo
// @Failure      500      {object}  map[string]string
// @Router       /todos [get]
func GetTodos(c *gin.Context) {
	if db.Pool == nil {
		log.Printf("Error: database pool is nil")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not initialized"})
		return
	}

	// Get sorting parameters
	sortBy := c.DefaultQuery("sort_by", "created_at")
	order := c.DefaultQuery("order", "desc")
	statusFilter := c.Query("status")
	storyPointsMinStr := c.Query("story_points_min")
	storyPointsMaxStr := c.Query("story_points_max")

	// Validate sort_by field
	validSortFields := map[string]bool{
		"due_date":   true,
		"priority":   true,
		"created_at": true,
	}
	if !validSortFields[sortBy] {
		sortBy = "created_at"
	}

	// Validate order
	if order != "asc" && order != "desc" {
		order = "desc"
	}

	// Validate status filter
	validStatuses := map[string]bool{
		"todo":        true,
		"in_progress": true,
		"done":        true,
	}
	if statusFilter != "" && !validStatuses[statusFilter] {
		statusFilter = ""
	}

	var orderByClause string
	switch sortBy {
	case "due_date":
		if order == "asc" {
			orderByClause = "ORDER BY due_date ASC NULLS LAST"
		} else {
			orderByClause = "ORDER BY due_date DESC NULLS LAST"
		}
	case "priority":
		// Priority order: High > Medium > Low
		if order == "asc" {
			orderByClause = "ORDER BY CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 END ASC"
		} else {
			orderByClause = "ORDER BY CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 END DESC"
		}
	default:
		orderByClause = "ORDER BY created_at " + order
	}

	// Build WHERE clause for filters
	whereConditions := []string{}
	queryArgs := []interface{}{}
	argIndex := 1

	if statusFilter != "" {
		whereConditions = append(whereConditions, "status = $"+strconv.Itoa(argIndex))
		queryArgs = append(queryArgs, statusFilter)
		argIndex++
	}

	// Parse and validate story points min
	if storyPointsMinStr != "" {
		storyPointsMin, err := strconv.Atoi(storyPointsMinStr)
		if err == nil && storyPointsMin >= 0 {
			whereConditions = append(whereConditions, "story_points >= $"+strconv.Itoa(argIndex))
			queryArgs = append(queryArgs, storyPointsMin)
			argIndex++
		}
	}

	// Parse and validate story points max
	if storyPointsMaxStr != "" {
		storyPointsMax, err := strconv.Atoi(storyPointsMaxStr)
		if err == nil && storyPointsMax >= 0 {
			whereConditions = append(whereConditions, "story_points <= $"+strconv.Itoa(argIndex))
			queryArgs = append(queryArgs, storyPointsMax)
			argIndex++
		}
	}

	whereClause := ""
	if len(whereConditions) > 0 {
		whereClause = "WHERE " + whereConditions[0]
		for i := 1; i < len(whereConditions); i++ {
			whereClause += " AND " + whereConditions[i]
		}
	}

	rows, err := db.Pool.Query(c.Request.Context(), `
		SELECT id, title, COALESCE(description, '') as description, status, due_date, priority, story_points, created_at, updated_at 
		FROM todos 
		`+whereClause+`
		`+orderByClause+`
	`, queryArgs...)
	if err != nil {
		log.Printf("Error querying todos: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch todos", "details": err.Error()})
		return
	}
	defer rows.Close()

	todos := []models.Todo{} // Initialize as empty slice to ensure JSON serializes to [] not null
	for rows.Next() {
		var todo models.Todo
		if err := rows.Scan(&todo.ID, &todo.Title, &todo.Description, &todo.Status, &todo.DueDate, &todo.Priority, &todo.StoryPoints, &todo.CreatedAt, &todo.UpdatedAt); err != nil {
			log.Printf("Error scanning todo: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan todo", "details": err.Error()})
			return
		}
		todos = append(todos, todo)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Error iterating todos: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error iterating todos", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, todos)
}

// GetTodo godoc
// @Summary      Get a todo by ID
// @Description  Get a single todo item by its ID
// @Tags         todos
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "Todo ID"
// @Success      200  {object}  models.Todo
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /todos/{id} [get]
func GetTodo(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	var todo models.Todo
	err = db.Pool.QueryRow(c.Request.Context(), `
		SELECT id, title, COALESCE(description, '') as description, status, due_date, priority, story_points, created_at, updated_at 
		FROM todos 
		WHERE id = $1
	`, id).Scan(&todo.ID, &todo.Title, &todo.Description, &todo.Status, &todo.DueDate, &todo.Priority, &todo.StoryPoints, &todo.CreatedAt, &todo.UpdatedAt)

	if err == pgx.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}
	if err != nil {
		log.Printf("Error fetching todo: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch todo", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, todo)
}

// CreateTodo godoc
// @Summary      Create a new todo
// @Description  Create a new todo item
// @Tags         todos
// @Accept       json
// @Produce      json
// @Param        todo  body      models.CreateTodoRequest  true  "Todo data"
// @Success      201   {object}  models.Todo
// @Failure      400   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /todos [post]
func CreateTodo(c *gin.Context) {
	var req models.CreateTodoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert empty description to NULL
	var description interface{}
	if req.Description == "" {
		description = nil
	} else {
		description = req.Description
	}

	// Set default priority if not provided
	priority := req.Priority
	if priority == "" {
		priority = "Medium"
	}

	// Set default status if not provided
	status := req.Status
	if status == "" {
		status = "todo"
	}

	// Validate story points if provided
	if req.StoryPoints != nil {
		validStoryPoints := map[int]bool{1: true, 2: true, 3: true, 5: true, 8: true}
		if !validStoryPoints[*req.StoryPoints] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid story points value. Must be one of: 1, 2, 3, 5, 8"})
			return
		}
	}

	var todo models.Todo
	err := db.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO todos (title, description, status, due_date, priority, story_points, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		RETURNING id, title, COALESCE(description, '') as description, status, due_date, priority, story_points, created_at, updated_at
	`, req.Title, description, status, req.DueDate, priority, req.StoryPoints).Scan(
		&todo.ID, &todo.Title, &todo.Description, &todo.Status, &todo.DueDate, &todo.Priority, &todo.StoryPoints, &todo.CreatedAt, &todo.UpdatedAt,
	)

	if err != nil {
		log.Printf("Error creating todo: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create todo", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, todo)
}

// UpdateTodo godoc
// @Summary      Update a todo
// @Description  Update an existing todo item
// @Tags         todos
// @Accept       json
// @Produce      json
// @Param        id    path      int  true  "Todo ID"
// @Param        todo  body      models.UpdateTodoRequest  true  "Todo data"
// @Success      200   {object}  models.Todo
// @Failure      400   {object}  map[string]string
// @Failure      404   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /todos/{id} [put]
func UpdateTodo(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	var req models.UpdateTodoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var todo models.Todo
	// Convert empty description to NULL for update
	var description interface{}
	if req.Description == "" {
		description = nil
	} else {
		description = req.Description
	}

	// Handle status update - use empty string check for optional field
	var status interface{}
	if req.Status == "" {
		status = nil
	} else {
		status = req.Status
	}

	// Validate story points if provided
	if req.StoryPoints != nil {
		validStoryPoints := map[int]bool{1: true, 2: true, 3: true, 5: true, 8: true}
		if !validStoryPoints[*req.StoryPoints] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid story points value. Must be one of: 1, 2, 3, 5, 8"})
			return
		}
	}

	err = db.Pool.QueryRow(c.Request.Context(), `
		UPDATE todos 
		SET title = COALESCE($1, title),
		    description = COALESCE($2, description),
		    status = COALESCE($3, status),
		    due_date = COALESCE($4, due_date),
		    priority = COALESCE($5, priority),
		    story_points = COALESCE($6, story_points),
		    updated_at = NOW()
		WHERE id = $7
		RETURNING id, title, COALESCE(description, '') as description, status, due_date, priority, story_points, created_at, updated_at
	`, req.Title, description, status, req.DueDate, req.Priority, req.StoryPoints, id).Scan(
		&todo.ID, &todo.Title, &todo.Description, &todo.Status, &todo.DueDate, &todo.Priority, &todo.StoryPoints, &todo.CreatedAt, &todo.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update todo"})
		return
	}

	c.JSON(http.StatusOK, todo)
}

// DeleteTodo godoc
// @Summary      Delete a todo
// @Description  Delete a todo item by its ID
// @Tags         todos
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "Todo ID"
// @Success      204  {string}  string  "No Content"
// @Failure      400  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /todos/{id} [delete]
func DeleteTodo(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	result, err := db.Pool.Exec(c.Request.Context(), `
		DELETE FROM todos WHERE id = $1
	`, id)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete todo"})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}

	c.Status(http.StatusNoContent)
}
