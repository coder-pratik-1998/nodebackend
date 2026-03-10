import express, { Request, Response, Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Types for our data
interface HealthResponse {
  status: string;
  timestamp: Date;
  uptime: number;
}

interface MessageResponse {
  message: string;
  environment: string;
}

// Routes
app.get('/', (req: Request, res: Response<MessageResponse>) => {
  res.json({ 
    message: 'TypeScript Node.js backend is running!',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req: Request, res: Response<HealthResponse>) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Example API route with params
app.get('/api/users/:id', (req: Request, res: Response) => {
  const userId = req.params.id;
  res.json({ 
    id: userId,
    name: `User ${userId}`,
    timestamp: new Date()
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔧 TypeScript version: ${process.versions.node}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});