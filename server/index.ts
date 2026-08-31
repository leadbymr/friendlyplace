import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import { translate } from '@vitalets/google-translate-api';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });

redis.on('error', (err) => {
  console.error('⚠️ Redis недоступен:', err.message);
});

const QUEUE_KEY = 'matchmaking:queue';
const ROOMS_KEY = 'chat:rooms';
const USER_ROOM_KEY = 'user:room';

const ADJECTIVES = ['Blue', 'Red', 'Green', 'Happy', 'Swift', 'Calm', 'Bold', 'Wild', 'Clever'];
const NOUNS = ['Panda', 'Fox', 'Owl', 'Wolf', 'Bear', 'Tiger', 'Eagle', 'Lion', 'Hawk'];

function generateNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 999);
  return `${adj} ${noun} ${num}`;
}

async function detectLanguage(text: string): Promise<string> {
  try {
    const result = await translate(text, { to: 'en' });
    const r = result as unknown as { from?: { language?: { iso?: string } } };
    return r?.from?.language?.iso || 'en';
  } catch {
    return 'en';
  }
}

async function translateText(text: string, from: string, to: string): Promise<string> {
  try {
    const result = await translate(text, { from, to });
    return result.text;
  } catch {
    return text;
  }
}

async function tryMatch() {
  const queueLength = await redis.llen(QUEUE_KEY);
  if (queueLength < 2) return;

  const pipeline = redis.pipeline();
  pipeline.rpop(QUEUE_KEY);
  pipeline.rpop(QUEUE_KEY);
  const results = await pipeline.exec();

  if (!results || results[0][1] === null || results[1][1] === null) return;

  const userA = JSON.parse(results[0][1] as string);
  const userB = JSON.parse(results[1][1] as string);

  const aAlive = io.sockets.sockets.has(userA.userId);
  const bAlive = io.sockets.sockets.has(userB.userId);

  // «призраки»: кто-то закрыл окно, стоя в очереди — не соединяем с пустотой
  if (!aAlive && !bAlive) return tryMatch();
  if (!aAlive) {
    await redis.lpush(QUEUE_KEY, JSON.stringify(userB));
    return tryMatch();
  }
  if (!bAlive) {
    await redis.lpush(QUEUE_KEY, JSON.stringify(userA));
    return tryMatch();
  }

  const roomId = uuid();
  const room = {
    id: roomId,
    users: [userA.userId, userB.userId],
    languages: {
      [userA.userId]: userA.language,
      [userB.userId]: userB.language,
    },
    createdAt: Date.now(),
  };

  await redis.hset(ROOMS_KEY, roomId, JSON.stringify(room));
  await redis.hset(USER_ROOM_KEY, userA.userId, roomId);
  await redis.hset(USER_ROOM_KEY, userB.userId, roomId);

  io.to(userA.userId).emit('matched', {
    roomId,
    partner: { nickname: generateNickname(), language: room.languages[userB.userId] },
  });
  io.to(userB.userId).emit('matched', {
    roomId,
    partner: { nickname: generateNickname(), language: room.languages[userA.userId] },
  });

  await tryMatch();
}

async function leaveRoom(socketId: string) {
  try {
    const roomId = await redis.hget(USER_ROOM_KEY, socketId);
    if (!roomId) return;

    const roomData = await redis.hget(ROOMS_KEY, roomId);
    if (roomData) {
      const room = JSON.parse(roomData);
      const partnerId = room.users.find((id: string) => id !== socketId);
      if (partnerId) {
        await redis.hdel(USER_ROOM_KEY, partnerId);
        io.to(partnerId).emit('partner_left', { message: 'Partner disconnected' });
      }
    }

    await redis.hdel(ROOMS_KEY, roomId);
    await redis.hdel(USER_ROOM_KEY, socketId);
  } catch (e) {
    console.error('leaveRoom error:', e);
  }
}

io.on('connection', (socket) => {
  console.log(`👤 Подключился: ${socket.id}`);

  socket.on('find_partner', async (data) => {
    try {
      const userId = socket.id;
      const language = data?.language || 'en';

      const currentRoom = await redis.hget(USER_ROOM_KEY, userId);
      if (currentRoom) {
        socket.emit('error', { message: 'Ты уже в чате' });
        return;
      }

      const userData = JSON.stringify({ userId, language, joinedAt: Date.now() });
      await redis.lpush(QUEUE_KEY, userData);
      socket.emit('searching', { message: 'Ищем собеседника...' });
      await tryMatch();
    } catch (e) {
      console.error(e);
      socket.emit('error', { message: 'Ошибка сервера. Проверь, запущен ли Redis.' });
    }
  });

  socket.on('chat:message', async (data) => {
    try {
      const userId = socket.id;
      const roomId = await redis.hget(USER_ROOM_KEY, userId);
      if (!roomId) {
        socket.emit('error', { message: 'Нет активного чата' });
        return;
      }

      const roomData = await redis.hget(ROOMS_KEY, roomId);
      if (!roomData) return;

      const room = JSON.parse(roomData);
      const partnerId = room.users.find((id: string) => id !== userId);
      if (!partnerId) return;

      const text = String(data?.text || '').slice(0, 1000);
      if (!text) return;

      const detectedLang = await detectLanguage(text);
      const partnerLang = room.languages[partnerId] || 'en';
      const translatedText = await translateText(text, detectedLang, partnerLang);

      io.to(partnerId).emit('chat:message', {
        messageId: uuid(),
        originalText: text,
        originalLang: detectedLang,
        translatedText,
        translatedLang: partnerLang,
        createdAt: new Date().toISOString(),
      });

      socket.emit('chat:message:sent', {
        messageId: uuid(),
        originalText: text,
        originalLang: detectedLang,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error(e);
      socket.emit('error', { message: 'Не удалось отправить сообщение' });
    }
  });

  /* реле «печатает...» */
  socket.on('chat:typing', async () => {
    try {
      const roomId = await redis.hget(USER_ROOM_KEY, socket.id);
      if (!roomId) return;
      const roomData = await redis.hget(ROOMS_KEY, roomId);
      if (!roomData) return;
      const room = JSON.parse(roomData);
      const partnerId = room.users.find((id: string) => id !== socket.id);
      if (partnerId) io.to(partnerId).emit('chat:typing');
    } catch (e) {
      console.error('typing error:', e);
    }
  });

  socket.on('leave_room', () => leaveRoom(socket.id));

  socket.on('next_partner', async () => {
    await leaveRoom(socket.id);
    socket.emit('ready_for_next');
  });

  socket.on('disconnect', () => {
    console.log(`👋 Отключился: ${socket.id}`);
    leaveRoom(socket.id);
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});