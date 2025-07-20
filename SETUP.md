# Analytica AI - Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js 18+** (https://nodejs.org/)
- **MongoDB** (https://www.mongodb.com/try/download/community) or Docker
- **Git** (https://git-scm.com/)

## Quick Start

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install all workspace dependencies
npm run install:all
```

### 2. Environment Setup

#### Backend Environment
Create `server/.env` file:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/analytica-ai

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:5173
```

#### Frontend Environment
Create `client/.env` file:
```env
# API Configuration
VITE_API_URL=http://localhost:3001/api
```

### 3. Database Setup

#### Option A: Local MongoDB
1. Install MongoDB Community Edition
2. Start MongoDB service
3. The application will automatically create the database

#### Option B: Docker (Recommended)
```bash
# Start only the database services
docker-compose up mongodb redis -d
```

### 4. Start Development Servers

#### Option A: Manual Start
```bash
# Terminal 1 - Backend
npm run dev:server

# Terminal 2 - Frontend  
npm run dev:client
```

#### Option B: Concurrent Start
```bash
# Start both servers concurrently
npm run dev
```

#### Option C: Full Docker Setup
```bash
# Start all services with Docker
docker-compose up
```

## Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **MongoDB**: localhost:27017 (if running locally)

## Testing the Authentication

### 1. Register a New User
1. Go to http://localhost:5173
2. Click "Sign up here"
3. Fill in the registration form
4. You'll be automatically logged in and redirected to the dashboard

### 2. Test API Endpoints

#### Register User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

#### Login User
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

#### Get Profile (Protected Route)
```bash
curl -X GET http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## Project Structure

```
analytica-ai/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # API services
│   │   └── stores/        # Zustand stores
│   └── package.json
├── server/                # NestJS backend
│   ├── src/
│   │   ├── auth/         # Authentication module
│   │   ├── user/         # User module
│   │   └── main.ts       # Application entry point
│   └── package.json
├── docker-compose.yml     # Docker services
└── README.md
```

## Next Steps

The foundational authentication system is now complete! You can now:

1. **Add File Upload Module**: Implement file upload functionality
2. **Add AI Integration**: Connect to OpenAI, Google Gemini, or other AI APIs
3. **Add Job Queue**: Implement BullMQ for background processing
4. **Add Data Visualization**: Integrate Chart.js or D3.js for analytics
5. **Add Report Generation**: Implement PDF generation for insights

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check the connection string in `.env`

2. **CORS Issues**
   - Verify `FRONTEND_URL` in backend `.env`
   - Check that frontend is running on the specified port

3. **JWT Token Issues**
   - Ensure `JWT_SECRET` is set in backend `.env`
   - Check that the token is being sent in Authorization header

4. **Dependencies Issues**
   - Delete `node_modules` and run `npm install` again
   - Ensure you're using Node.js 18+

### Getting Help

If you encounter issues:
1. Check the console logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure all services are running (MongoDB, backend, frontend)

## Development Commands

```bash
# Root level commands
npm run dev              # Start both frontend and backend
npm run dev:server       # Start only backend
npm run dev:client       # Start only frontend
npm run build           # Build both projects
npm run install:all     # Install all dependencies

# Backend commands (in server/)
npm run start:dev       # Development mode with hot reload
npm run start:prod      # Production mode
npm run build          # Build for production

# Frontend commands (in client/)
npm run dev            # Development server
npm run build          # Build for production
npm run preview        # Preview production build
``` 