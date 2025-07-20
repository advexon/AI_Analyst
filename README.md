# Analytica AI

Enterprise AI Data Analysis & Visualization Platform

## Overview

Analytica AI is a professional, enterprise-grade SaaS platform that empowers users to upload raw data files, leverage multiple large language models (LLMs) for in-depth analysis, and receive insights through interactive dashboards, visualizations, and downloadable reports.

## Features

- 🔐 **Secure Authentication** - JWT-based auth with OAuth support
- 📁 **File Management** - Upload CSV, JSON, XLSX files with status tracking
- 🤖 **AI Analysis** - Multiple LLM integrations (GPT-4, Gemini, Grok)
- 📊 **Data Visualization** - Interactive charts and dashboards
- 📄 **Report Generation** - Downloadable PDF and structured reports
- 🚀 **Enterprise Ready** - Scalable, secure, and reliable

## Tech Stack

### Frontend
- **React 18+** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Shadcn/UI** for components
- **Zustand** for state management
- **React Query** for data fetching
- **Recharts** for visualizations

### Backend
- **NestJS** with TypeScript
- **MongoDB** with Mongoose
- **JWT** authentication with Passport.js
- **BullMQ** with Redis for job processing
- **Docker** for containerization

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB
- Redis (for job queue)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd analytica-ai
```

2. Install dependencies:
```bash
npm run install:all
```

3. Set up environment variables (see `.env.example` files in client and server directories)

4. Start development servers:
```bash
npm run dev
```

This will start both the backend server (port 3001) and frontend development server (port 5173).

## Project Structure

```
analytica-ai/
├── client/          # React frontend
├── server/          # NestJS backend
├── docker-compose.yml
└── README.md
```

## Development

- **Frontend**: `npm run dev:client`
- **Backend**: `npm run dev:server`
- **Both**: `npm run dev`

## Deployment

The application is containerized with Docker. Use Docker Compose for development and Kubernetes for production deployment.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

Private - Enterprise License 