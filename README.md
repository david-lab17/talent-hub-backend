# M-Pesa Africa Talent Hub - Backend

Express.js REST API server for the M-Pesa Africa Talent Hub, providing assessment management, code execution, and candidate evaluation capabilities.

## Features

- RESTful API with TypeScript
- PostgreSQL database with Drizzle ORM
- Session-based authentication
- Piston-powered code execution (50+ languages)
- Automated test case evaluation
- Structured logging with Pino

## Requirements

- Node.js 18+
- PostgreSQL 14+
- Docker (for Piston code execution)
- npm

## Installation

### 1. Start Piston (Code Execution Engine)

Piston provides secure, sandboxed code execution. Run it with Docker:

```bash
docker run -d --name piston -p 2000:2000 ghcr.io/engineer-man/piston
```

Verify it's running:
```bash
curl http://localhost:2000/api/v2/runtimes
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database connection string
DATABASE_URL=postgresql://user:password@localhost:5432/interview_platform

# Session secret (use a strong random string in production)
SESSION_SECRET=your-super-secret-session-key

# Server port
PORT=3001

# Environment
NODE_ENV=development

# Piston API URL (local Docker instance)
PISTON_API_URL=http://localhost:2000/api/v2
```

### 4. Database Setup

```bash
# Push schema to database
npm run db:push

# Seed initial data
npm run db:seed
```

The seed script creates:
- Default admin user: `admin@example.com` / `admin123`
- Sample "JavaScript Fundamentals" assessment with questions

### 5. Start the Server

```bash
npm run dev
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run migrations |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Drizzle Studio GUI |
| `npm run db:seed` | Seed database with initial data |

## Code Execution with Piston

The backend uses [Piston](https://github.com/engineer-man/piston) for secure, sandboxed code execution.

### Supported Languages

| Language | Runtime | Language | Runtime |
|----------|---------|----------|---------|
| JavaScript | Node.js 18 | TypeScript | TypeScript 5 |
| Python | Python 3.10 | Java | JDK 15 |
| C | GCC 10 | C++ | G++ 10 (C++17) |
| C# | Mono 6 | Go | Go 1.16 |
| Rust | Rust 1.68 | Ruby | Ruby 3 |
| PHP | PHP 8 | Swift | Swift 5 |
| Kotlin | Kotlin 1.8 | | |

### Piston Management

```bash
# Start Piston
docker start piston

# Stop Piston
docker stop piston

# View logs
docker logs piston

# Restart Piston
docker restart piston
```

### Fallback

If local Piston is unavailable, the system automatically falls back to the public API at `https://emkc.org/api/v2/piston` (rate limited - not recommended for production).

### Security Features

- Isolated container execution per request
- Memory and CPU limits
- Execution timeout (5s run, 10s compile)
- No network access from executed code
- No filesystem persistence

## Project Structure

```
src/
├── db/
│   ├── index.ts      # Database connection
│   └── schema.ts     # Drizzle schema definitions
├── lib/
│   ├── code-runner.ts # Piston API integration
│   └── logger.ts      # Pino logger configuration
├── middleware/
│   └── auth.ts        # Authentication middleware
├── routes/
│   ├── admin.ts       # Admin submission review
│   ├── assessments.ts # Assessment CRUD
│   ├── auth.ts        # Authentication endpoints
│   ├── candidates.ts  # Candidate session handling
│   ├── execute.ts     # Code execution
│   ├── health.ts      # Health check
│   ├── index.ts       # Route aggregation
│   ├── invitations.ts # Invitation management
│   └── questions.ts   # Question CRUD
├── app.ts             # Express app setup
├── index.ts           # Server entry point
└── seed.ts            # Database seeder
```

## API Endpoints

### Authentication

```
POST /api/auth/login
  Body: { email, password }
  Response: { success, user: { id, email, name } }

POST /api/auth/logout
  Response: { success }

GET /api/auth/me
  Response: { id, email, name }
```

### Assessments

```
GET /api/assessments
  Response: Assessment[]

POST /api/assessments
  Body: { title, description?, timeLimitMinutes, isActive? }
  Response: Assessment

GET /api/assessments/:id
  Response: Assessment with questions and invitations

PATCH /api/assessments/:id
  Body: Partial<Assessment>
  Response: Assessment

DELETE /api/assessments/:id
  Response: { success }
```

### Questions

```
GET /api/assessments/:assessmentId/questions
  Response: Question[]

POST /api/assessments/:assessmentId/questions
  Body: { title, description, difficulty, points, starterCode?, testCases }
  Response: Question

PATCH /api/questions/:id
  Body: Partial<Question>
  Response: Question

DELETE /api/questions/:id
  Response: { success }
```

### Invitations

```
GET /api/assessments/:assessmentId/invitations
  Response: Invitation[]

POST /api/assessments/:assessmentId/invitations
  Body: { candidateEmail, candidateName? }
  Response: Invitation with token

DELETE /api/invitations/:id
  Response: { success }
```

### Candidate Endpoints

```
GET /api/invite/:token
  Response: { token, assessmentTitle, timeLimitMinutes, questionCount, status }

POST /api/invite/:token/start
  Body: { name, email }
  Response: { submissionId, candidateToken, questions, startedAt }

GET /api/session/:token
  Response: { submissionId, questions, startedAt }

PATCH /api/submissions/:id/autosave
  Body: { questionId, code, language }
  Response: { message }

POST /api/submissions/:id/submit
  Response: { totalScore, maxScore, percentage }
```

### Code Execution

```
POST /api/execute
  Body: { questionId, code, language }
  Response: { results: TestResult[], stdout, stderr }

GET /api/languages
  Response: [{ id, name, extension }]
```

### Admin Review

```
GET /api/admin/submissions
  Query: { assessmentId?, status? }
  Response: Submission[]

GET /api/admin/submissions/:id
  Response: Submission with answers and results
```

## Database Schema

| Table | Description |
|-------|-------------|
| `admin_users` | Admin accounts |
| `assessments` | Assessment definitions |
| `questions` | Coding questions |
| `test_cases` | Input/output test pairs |
| `invitations` | Candidate invitations |
| `candidates` | Candidate records |
| `submissions` | Assessment submissions |
| `submission_answers` | Individual answers |
| `evaluation_results` | Test case results |

## Development

```bash
# Start with hot reload
npm run dev

# View logs in pretty format
npm run dev | npx pino-pretty
```

## Production

```bash
# Build TypeScript
npm run build

# Start production server
NODE_ENV=production npm start
```

## Troubleshooting

### Piston not responding

```bash
# Check if container is running
docker ps | grep piston

# Restart Piston
docker restart piston

# Check logs for errors
docker logs piston --tail 50
```

### Database connection issues

```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1"

# Re-push schema
npm run db:push
```

## License

MIT
