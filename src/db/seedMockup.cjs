const path = require('path');
const dbPath = path.resolve(process.cwd(), 'kabaly.db');
const db = require('better-sqlite3')(dbPath);
const now = new Date().toISOString();

// 1. Ensure Luna Astral
db.prepare(`
  INSERT INTO users (id, name, email, password_hash, role, avatar, cover_image, handle, bio, coins_balance, is_age_verified, created_at, updated_at)
  VALUES ('usr_tarotista_1', 'Luna Astral', 'luna@kabaly.app', 'dummy_hash', 'tarotista', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200', '@luna_astral', 'Guía espiritual y tarotista con más de 10 años de experiencia. Te ayudo a encontrar claridad, equilibrio y respuestas en tu camino. ✨', 5000, 1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET 
    name = 'Luna Astral',
    handle = '@luna_astral',
    avatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
    cover_image = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200',
    bio = 'Guía espiritual y tarotista con más de 10 años de experiencia. Te ayudo a encontrar claridad, equilibrio y respuestas en tu camino. ✨',
    updated_at = ?
`).run(now, now, now);

db.prepare(`
  INSERT INTO tarotista_profiles (id, user_id, professional_name, avatar, banner, specialties, bio, experience_years, price_per_min_coins, price_per_min_eur, languages, country, is_verified, kyc_status, stripe_connect_status, rating_average, total_reviews, total_readings, followers_count, video_count, availability_status, custom_commission_percentage, created_at)
  VALUES ('tar_1', 'usr_tarotista_1', 'Luna Astral', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200', '["Tarot", "Astrología", "Limpiezas energéticas"]', 'Guía espiritual y tarotista con más de 10 años de experiencia. Te ayudo a encontrar claridad, equilibrio y respuestas en tu camino. ✨', 10, 15, 1.50, '["Español"]', 'España', 1, 'aprobado', 'conectado', 5.0, 326, 1420, 3400, 24, 'online', 20, ?)
  ON CONFLICT(id) DO UPDATE SET
    professional_name = 'Luna Astral',
    avatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
    banner = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=1200',
    specialties = '["Tarot", "Astrología", "Limpiezas energéticas"]',
    bio = 'Guía espiritual y tarotista con más de 10 años de experiencia. Te ayudo a encontrar claridad, equilibrio y respuestas en tu camino. ✨',
    price_per_min_coins = 15,
    price_per_min_eur = 1.50,
    rating_average = 5.0,
    total_reviews = 326,
    followers_count = 3400,
    availability_status = 'online'
`).run(now);

// 2. Ensure El Caminante
db.prepare(`
  INSERT INTO users (id, name, email, password_hash, role, avatar, cover_image, handle, bio, coins_balance, is_age_verified, created_at, updated_at)
  VALUES ('usr_tarotista_2', 'El Caminante', 'caminante@kabaly.app', 'dummy_hash', 'tarotista', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400', 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&q=80&w=1200', '@el_caminante', 'Intérprete de runas nórdicas y arcanos mayores. Revelando caminos ocultos.', 3200, 1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = 'El Caminante',
    handle = '@el_caminante',
    avatar = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
    updated_at = ?
`).run(now, now, now);

db.prepare(`
  INSERT INTO tarotista_profiles (id, user_id, professional_name, avatar, banner, specialties, bio, experience_years, price_per_min_coins, price_per_min_eur, languages, country, is_verified, kyc_status, stripe_connect_status, rating_average, total_reviews, total_readings, followers_count, video_count, availability_status, custom_commission_percentage, created_at)
  VALUES ('tar_2', 'usr_tarotista_2', 'El Caminante', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400', 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&q=80&w=1200', '["Tarot", "Runas"]', 'Intérprete de runas nórdicas y arcanos mayores. Revelando caminos ocultos.', 12, 12, 1.20, '["Español"]', 'España', 1, 'aprobado', 'conectado', 4.9, 212, 850, 1850, 12, 'online', 20, ?)
  ON CONFLICT(id) DO UPDATE SET
    professional_name = 'El Caminante',
    avatar = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
    specialties = '["Tarot", "Runas"]',
    price_per_min_coins = 12,
    price_per_min_eur = 1.20,
    rating_average = 4.9,
    total_reviews = 212,
    availability_status = 'online'
`).run(now);

// 3. Ensure Madame Sol
db.prepare(`
  INSERT INTO users (id, name, email, password_hash, role, avatar, cover_image, handle, bio, coins_balance, is_age_verified, created_at, updated_at)
  VALUES ('usr_tarotista_3', 'Madame Sol', 'madamesol@kabaly.app', 'dummy_hash', 'tarotista', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=1200', '@madame_sol', 'Videncia pura y decodificación vibracional de la fecha de nacimiento.', 4500, 1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = 'Madame Sol',
    handle = '@madame_sol',
    avatar = 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400',
    updated_at = ?
`).run(now, now, now);

db.prepare(`
  INSERT INTO tarotista_profiles (id, user_id, professional_name, avatar, banner, specialties, bio, experience_years, price_per_min_coins, price_per_min_eur, languages, country, is_verified, kyc_status, stripe_connect_status, rating_average, total_reviews, total_readings, followers_count, video_count, availability_status, custom_commission_percentage, created_at)
  VALUES ('tar_3', 'usr_tarotista_3', 'Madame Sol', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=1200', '["Vidente", "Numerología"]', 'Videncia pura y decodificación vibracional de la fecha de nacimiento.', 18, 18, 1.80, '["Español"]', 'España', 1, 'aprobado', 'conectado', 5.0, 418, 1920, 4200, 30, 'online', 20, ?)
  ON CONFLICT(id) DO UPDATE SET
    professional_name = 'Madame Sol',
    avatar = 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400',
    specialties = '["Vidente", "Numerología"]',
    price_per_min_coins = 18,
    price_per_min_eur = 1.80,
    rating_average = 5.0,
    total_reviews = 418,
    availability_status = 'online'
`).run(now);

// 4. Ensure Luna Astral posts
const posts = [
  {
    id: 'post_luna_1',
    tarotista_id: 'usr_tarotista_1',
    tarotista_name: 'Luna Astral',
    tarotista_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
    title: 'Arcano del Sol: Iluminación y Triunfo',
    category: 'Tarot',
    media_type: 'video',
    thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800',
    video_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800',
    likes: 842,
    comments_count: 56
  },
  {
    id: 'post_luna_2',
    tarotista_id: 'usr_tarotista_1',
    tarotista_name: 'Luna Astral',
    tarotista_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
    title: 'Portal de Luna Llena Cósmica',
    category: 'Astrología',
    media_type: 'video',
    thumbnail_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=800',
    video_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&q=80&w=800',
    likes: 1205,
    comments_count: 98
  },
  {
    id: 'post_luna_3',
    tarotista_id: 'usr_tarotista_1',
    tarotista_name: 'Luna Astral',
    tarotista_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
    title: 'Ritual Sagrado de Velas y Salvia Blanca',
    category: 'Rituales',
    media_type: 'video',
    thumbnail_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&q=80&w=800',
    video_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&q=80&w=800',
    likes: 670,
    comments_count: 42
  }
];

for (const p of posts) {
  db.prepare(`
    INSERT INTO videos (id, tarotista_id, tarotista_name, tarotista_avatar, is_verified, title, video_url, thumbnail_url, category, likes, comments_count, shares_count, sound_title, is_premium, price_coins, created_at, media_type, description, is_deleted)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 15, 'Sintonía Cósmica 432Hz', 0, NULL, ?, ?, 'Canalización de luz y guía para este tránsito astrológico.', 0)
    ON CONFLICT(id) DO UPDATE SET
      tarotista_id = excluded.tarotista_id,
      tarotista_name = excluded.tarotista_name,
      tarotista_avatar = excluded.tarotista_avatar,
      thumbnail_url = excluded.thumbnail_url,
      video_url = excluded.video_url,
      likes = excluded.likes
  `).run(p.id, p.tarotista_id, p.tarotista_name, p.tarotista_avatar, p.title, p.video_url, p.thumbnail_url, p.category, p.likes, p.comments_count, now, p.media_type);
}

console.log('Seed executed successfully!');

