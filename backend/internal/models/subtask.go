package models

import "time"

// Subtask represents a subtask item belonging to a todo
type Subtask struct {
	ID        int64     `json:"id" db:"id"`
	TodoID    int64     `json:"todo_id" db:"todo_id"`
	Title     string    `json:"title" db:"title"`
	Completed bool      `json:"completed" db:"completed"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// CreateSubtaskRequest represents the request body for creating a subtask
type CreateSubtaskRequest struct {
	Title string `json:"title" binding:"required" example:"Buy milk"`
}

// UpdateSubtaskRequest represents the request body for updating a subtask
type UpdateSubtaskRequest struct {
	Title     string `json:"title" example:"Buy organic milk"`
	Completed bool   `json:"completed" example:"false"`
}
