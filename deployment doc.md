# Deployment Guide

This guide describes how to deploy the backend and the database using Docker and Docker Compose on a Linux server.

## Prerequisites

-   A Linux server (Ubuntu 20.04+ recommended)
-   [Docker](https://docs.docker.com/engine/install/) installed
-   [Docker Compose](https://docs.docker.com/compose/install/) installed
-   Git installed

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd Interview
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory (where `docker-compose.yml` is located) to manage your production secrets:

```bash
# .env
DB_PASSWORD=your-secure-db-password
SESSION_SECRET=your-production-session-secret
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,https://your-admin-portal.vercel.app,https://your-candidate-portal.vercel.app
SECURE_COOKIES=false
```

The `docker-compose.yml` is already configured to use these variables.

### 3. Deploy with Docker Compose

Run the following command to build and start the containers in detached mode:

```bash
docker compose up -d --build
```

This will:
-   Start a PostgreSQL 16 container.
-   Build the backend Docker image.
-   Start the backend container, connected to the database.
-   Expose the backend on port `3001` (http://62.171.140.6:3001) and the database on port `5432`.

### 4. Database Migrations

After the containers are running, you need to apply the database migrations. Run this command to execute migrations inside the backend container:

```bash
docker compose exec backend npm run db:push
```

*(Optional)* If you want to seed the database with initial data:

```bash
docker compose exec backend npm run db:seed
```

## Useful Commands

### Viewing Logs

```bash
# View logs for all services
docker compose logs -f

# View logs for the backend only
docker compose logs -f backend
```

### Stopping the Services

```bash
docker compose down
```

### Restarting the Services

```bash
docker compose restart
```

## Troubleshooting

-   **Database connection issues**: Ensure the `DATABASE_URL` in `docker-compose.yml` uses the service name `db` instead of `localhost`.
-   **Port conflicts**: If port 3001 or 5432 is already in use on the server, update the `ports` section in `docker-compose.yml`.
-   **Permission issues**: If you encounter permission errors with Docker, ensure your user is in the `docker` group or run commands with `sudo`.
