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

// GetSubtasks godoc
// @Summary      List all subtasks for a todo
// @Description  Get a list of all subtasks belonging to a specific todo
// @Tags         subtasks
// @Accept       json
// @Produce      json
// @Param        id   path      int  true  "Todo ID"
// @Success      200  {array}   models.Subtask
// @Failure      400  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /todos/{id}/subtasks [get]
func GetSubtasks(c *gin.Context) {
	if db.Pool == nil {
		log.Printf("Error: database pool is nil")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not initialized"})
		return
	}

	todoID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	// Verify todo exists
	var todoExists bool
	err = db.Pool.QueryRow(c.Request.Context(), `
		SELECT EXISTS(SELECT 1 FROM todos WHERE id = $1)
	`, todoID).Scan(&todoExists)
	if err != nil {
		log.Printf("Error checking todo existence: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify todo", "details": err.Error()})
		return
	}
	if !todoExists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}

	rows, err := db.Pool.Query(c.Request.Context(), `
		SELECT id, todo_id, title, completed, created_at, updated_at 
		FROM subtasks 
		WHERE todo_id = $1
		ORDER BY created_at ASC
	`, todoID)
	if err != nil {
		log.Printf("Error querying subtasks: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch subtasks", "details": err.Error()})
		return
	}
	defer rows.Close()

	var subtasks []models.Subtask
	for rows.Next() {
		var subtask models.Subtask
		if err := rows.Scan(&subtask.ID, &subtask.TodoID, &subtask.Title, &subtask.Completed, &subtask.CreatedAt, &subtask.UpdatedAt); err != nil {
			log.Printf("Error scanning subtask: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan subtask", "details": err.Error()})
			return
		}
		subtasks = append(subtasks, subtask)
	}

	if err := rows.Err(); err != nil {
		log.Printf("Error iterating subtasks: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error iterating subtasks", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, subtasks)
}

// CreateSubtask godoc
// @Summary      Create a new subtask
// @Description  Create a new subtask for a specific todo
// @Tags         subtasks
// @Accept       json
// @Produce      json
// @Param        id    path      int  true  "Todo ID"
// @Param        subtask  body      models.CreateSubtaskRequest  true  "Subtask data"
// @Success      201   {object}  models.Subtask
// @Failure      400   {object}  map[string]string
// @Failure      404   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /todos/{id}/subtasks [post]
func CreateSubtask(c *gin.Context) {
	if db.Pool == nil {
		log.Printf("Error: database pool is nil")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not initialized"})
		return
	}

	todoID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	// Verify todo exists
	var todoExists bool
	err = db.Pool.QueryRow(c.Request.Context(), `
		SELECT EXISTS(SELECT 1 FROM todos WHERE id = $1)
	`, todoID).Scan(&todoExists)
	if err != nil {
		log.Printf("Error checking todo existence: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify todo", "details": err.Error()})
		return
	}
	if !todoExists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Todo not found"})
		return
	}

	var req models.CreateSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var subtask models.Subtask
	err = db.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO subtasks (todo_id, title, completed, created_at, updated_at)
		VALUES ($1, $2, $3, NOW(), NOW())
		RETURNING id, todo_id, title, completed, created_at, updated_at
	`, todoID, req.Title, false).Scan(
		&subtask.ID, &subtask.TodoID, &subtask.Title, &subtask.Completed, &subtask.CreatedAt, &subtask.UpdatedAt,
	)

	if err != nil {
		log.Printf("Error creating subtask: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subtask", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, subtask)
}

// UpdateSubtask godoc
// @Summary      Update a subtask
// @Description  Update an existing subtask
// @Tags         subtasks
// @Accept       json
// @Produce      json
// @Param        id         path      int  true  "Todo ID"
// @Param        subtaskId  path      int  true  "Subtask ID"
// @Param        subtask    body      models.UpdateSubtaskRequest  true  "Subtask data"
// @Success      200   {object}  models.Subtask
// @Failure      400   {object}  map[string]string
// @Failure      404   {object}  map[string]string
// @Failure      500   {object}  map[string]string
// @Router       /todos/{id}/subtasks/{subtaskId} [put]
func UpdateSubtask(c *gin.Context) {
	if db.Pool == nil {
		log.Printf("Error: database pool is nil")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not initialized"})
		return
	}

	todoID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	subtaskID, err := strconv.ParseInt(c.Param("subtaskId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subtask ID"})
		return
	}

	var req models.UpdateSubtaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var subtask models.Subtask
	// Use CASE to only update title if provided, and always update completed
	err = db.Pool.QueryRow(c.Request.Context(), `
		UPDATE subtasks 
		SET title = CASE 
			WHEN $1 != '' THEN $1 
			ELSE title 
		END,
		completed = $2,
		updated_at = NOW()
		WHERE id = $3 AND todo_id = $4
		RETURNING id, todo_id, title, completed, created_at, updated_at
	`, req.Title, req.Completed, subtaskID, todoID).Scan(
		&subtask.ID, &subtask.TodoID, &subtask.Title, &subtask.Completed, &subtask.CreatedAt, &subtask.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "Subtask not found"})
		return
	}
	if err != nil {
		log.Printf("Error updating subtask: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update subtask", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, subtask)
}

// DeleteSubtask godoc
// @Summary      Delete a subtask
// @Description  Delete a subtask by its ID
// @Tags         subtasks
// @Accept       json
// @Produce      json
// @Param        id         path      int  true  "Todo ID"
// @Param        subtaskId  path      int  true  "Subtask ID"
// @Success      204  {string}  string  "No Content"
// @Failure      400  {object}  map[string]string
// @Failure      404  {object}  map[string]string
// @Failure      500  {object}  map[string]string
// @Router       /todos/{id}/subtasks/{subtaskId} [delete]
func DeleteSubtask(c *gin.Context) {
	if db.Pool == nil {
		log.Printf("Error: database pool is nil")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database connection not initialized"})
		return
	}

	todoID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid todo ID"})
		return
	}

	subtaskID, err := strconv.ParseInt(c.Param("subtaskId"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subtask ID"})
		return
	}

	result, err := db.Pool.Exec(c.Request.Context(), `
		DELETE FROM subtasks WHERE id = $1 AND todo_id = $2
	`, subtaskID, todoID)

	if err != nil {
		log.Printf("Error deleting subtask: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete subtask", "details": err.Error()})
		return
	}

	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Subtask not found"})
		return
	}

	c.Status(http.StatusNoContent)
}
