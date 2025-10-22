import 'dotenv/config';
import { Oweb } from 'owebjs';
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// MongoDB Bağlantısı
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB'ye bağlanıldı (Video Server)"))
  .catch((err) => console.error("❌ MongoDB bağlantı hatası:", err));

const app = new Oweb();
const server = await app.setup();

// CORS
await server.register(fastifyCors, {
  origin: '*'
});

// Static files (uploaded videos and thumbnails)
await server.register(fastifyStatic, {
  root: path.join(__dirname, 'uploads'),
  prefix: '/uploads/'
});

// Load routes
await server.loadRoutes({
  directory: './routes',
  hmr: {
    enabled: process.env.NODE_ENV !== 'production'
  }
});

// Start server
const { err, address } = await server.start({
  port: parseInt(process.env.PORT) || 5001,
  host: '127.0.0.1'
});

if (err) {
  console.error('❌ Server başlatma hatası:', err);
  process.exit(1);
}

console.log(` Server is working on ${address}`);
