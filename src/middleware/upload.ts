import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Storage en disco con nombres seguros y únicos
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `media_${uniqueSuffix}${ext}`);
  },
});

// Formatos admitidos verificados
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
]);

export const uploadMediaMiddleware = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // Máximo 50MB
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato no admitido. Formatos válidos: JPG, PNG, WEBP, GIF, MP4, WEBM, MOV.'));
    }
  },
});

export const PRIVATE_CHAT_DIR = path.join(process.cwd(), 'private_storage', 'chat_attachments');
if (!fs.existsSync(PRIVATE_CHAT_DIR)) {
  fs.mkdirSync(PRIVATE_CHAT_DIR, { recursive: true });
}

const privateChatStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PRIVATE_CHAT_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    cb(null, `chat_att_${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_CHAT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const uploadPrivateChatMiddleware = multer({
  storage: privateChatStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Máximo 10MB para imágenes de chat
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_CHAT_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPEG, PNG, WEBP, GIF) en el chat privado.'));
    }
  },
});

