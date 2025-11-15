# BDRT Backend - Java Spring Boot Application

Backend server for Block Diagram and Signal Flow Graph Reduction Tool.

## Features

- RESTful API for saving/loading diagrams
- Graph reduction algorithms
- H2 in-memory database for persistence
- CORS enabled for frontend integration

## Prerequisites

- Java 17 or higher
- Maven 3.6+

## Setup and Run

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Build the project:**
   ```bash
   mvn clean install
   ```

3. **Run the application:**
   ```bash
   mvn spring-boot:run
   ```

   Or run the main class: `com.bdrt.BdrtApplication`

4. **Server will start on:** `http://localhost:8080`

## API Endpoints

### Save Diagram
- **POST** `/api/diagrams`
- **Body:** JSON with diagram data (blocks, connections, metadata)
- **Response:** Saved diagram with ID

### Get All Diagrams
- **GET** `/api/diagrams`
- **Response:** List of all saved diagrams

### Get Diagram by ID
- **GET** `/api/diagrams/{id}`
- **Response:** Diagram data

### Reduce Graph
- **POST** `/api/reduce`
- **Body:** JSON with blocks and connections
- **Response:** Reduced graph with transfer function

## Database

Uses H2 in-memory database. Data is stored in `./data/bdrt.mv.db` file.

## Project Structure

```
backend/
├── src/
│   ├── main/
│   │   ├── java/com/bdrt/
│   │   │   ├── controller/    # REST controllers
│   │   │   ├── service/       # Business logic
│   │   │   ├── repository/    # Data access
│   │   │   ├── model/         # Entity models
│   │   │   ├── dto/           # Data transfer objects
│   │   │   └── config/        # Configuration
│   │   └── resources/
│   │       └── application.properties
│   └── test/
└── pom.xml
```

## Integration with Frontend

The frontend is configured to connect to `http://localhost:8080/api`. Make sure the backend is running before using save/load/reduce features.

