import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Import routes
import authRoutes from './routes/auth.routes';
import adAccountRoutes from './routes/adAccount.routes';
import duplicationRoutes from './routes/duplication.routes';
import templateRoutes from './routes/template.routes';

app.use('/api/auth', authRoutes);
app.use('/api/adaccounts', adAccountRoutes);
app.use('/api/duplicate', duplicationRoutes);
app.use('/api/templates', templateRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export { prisma };
