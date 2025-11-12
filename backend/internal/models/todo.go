package models

import "time"

// Todo represents a todo item
type Todo struct {
	ID              int64      `json:"id" db:"id"`
	Title           string     `json:"title" db:"title"`
	Description     string     `json:"description" db:"description"`
	Status          string     `json:"status" db:"status"`
	DueDate         *time.Time `json:"due_date,omitempty" db:"due_date"`
	Priority        string     `json:"priority" db:"priority"`
	Subtasks        []Subtask  `json:"subtasks,omitempty" db:"-"`
	SubtaskProgress string     `json:"subtask_progress,omitempty" db:"-"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

// CreateTodoRequest represents the request body for creating a todo
type CreateTodoRequest struct {
	Title       string     `json:"title" binding:"required" example:"Buy groceries"`
	Description string     `json:"description" example:"Milk, eggs, bread"`
	Status      string     `json:"status,omitempty" example:"todo" binding:"omitempty,oneof=todo in_progress done"`
	DueDate     *time.Time `json:"due_date,omitempty" example:"2024-12-31T00:00:00Z"`
	Priority    string     `json:"priority" example:"Medium" binding:"oneof=High Medium Low"`
}

// UpdateTodoRequest represents the request body for updating a todo
type UpdateTodoRequest struct {
	Title       string     `json:"title" example:"Buy groceries"`
	Description string     `json:"description" example:"Milk, eggs, bread"`
	Status      string     `json:"status,omitempty" example:"in_progress" binding:"omitempty,oneof=todo in_progress done"`
	DueDate     *time.Time `json:"due_date,omitempty" example:"2024-12-31T00:00:00Z"`
	Priority    string     `json:"priority" example:"Medium" binding:"oneof=High Medium Low"`
}
