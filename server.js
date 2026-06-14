const express = require('express');
const sqlite3 = require('@oggynjack/sqlite3').verbose();
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./database.db');

db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        artist TEXT NOT NULL,
        src TEXT NOT NULL,
        plays INTEGER DEFAULT 0
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        song_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (song_id) REFERENCES songs(id),
        UNIQUE(user_id, song_id)
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
`);

db.run(`
    CREATE TABLE IF NOT EXISTS playlist_songs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        playlist_id INTEGER NOT NULL,
        song_id INTEGER NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
        FOREIGN KEY (song_id) REFERENCES songs(id),
        UNIQUE(playlist_id, song_id)
    )
`);

// Заполняем треки если таблица пустая
const seedSongs = [
    {id:1,  name:'Demo 1',  artist:'Study Beats',   src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'},
    {id:2,  name:'Demo 2',  artist:'Study Beats',   src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'},
    {id:3,  name:'Demo 3',  artist:'Study Beats',   src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'},
    {id:4,  name:'Demo 4',  artist:'Neon Drifter',  src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'},
    {id:5,  name:'Demo 5',  artist:'Neon Drifter',  src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'},
    {id:6,  name:'Demo 6',  artist:'Neon Drifter',  src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'},
    {id:7,  name:'Demo 7',  artist:'Guitar Mood',   src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'},
    {id:8,  name:'Demo 8',  artist:'Guitar Mood',   src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'},
    {id:9,  name:'Demo 9',  artist:'Guitar Mood',   src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'},
    {id:10, name:'Demo 10', artist:'Quantum Beats', src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'},
    {id:11, name:'Demo 11', artist:'Quantum Beats', src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'},
    {id:12, name:'Demo 12', artist:'Quantum Beats', src:'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'},
];

db.get('SELECT COUNT(*) as cnt FROM songs', (err, row) => {
    if (!err && row.cnt === 0) {
        const stmt = db.prepare('INSERT INTO songs (id, name, artist, src, plays) VALUES (?, ?, ?, ?, 0)');
        seedSongs.forEach(s => stmt.run(s.id, s.name, s.artist, s.src));
        stmt.finalize();
        console.log('✅ Треки добавлены в БД');
    }
});

const WEAK_PASSWORDS = new Set([
    '123','1234','12345','123456','1234567','12345678','123456789','1234567890',
    'qwerty','qwerty123','password','password1','pass','passwd',
    'abc','abc123','abcd','abcdef','abcd1234',
    '111','1111','11111','111111','000000','0000','000',
    'iloveyou','letmein','welcome','admin','admin123','root','test','test123',
    'qazwsx','zxcvbn','qwertyuiop','asdfghjkl',
    'monkey','dragon','master','sunshine','princess','football',
    'login','user','guest','demo','sample',
    'пароль','пароль1','привет','qwerty','йцукен',
]);

function validatePassword(password) {
    if (password.length < 6) {
        return 'Пароль должен содержать не менее 6 символов';
    }
    if (WEAK_PASSWORDS.has(password.toLowerCase())) {
        return 'Пароль слишком простой. Придумайте надёжный пароль';
    }
    if (/^(.)\1+$/.test(password)) {
        return 'Пароль не может состоять из одинаковых символов';
    }
    if (/^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def)+$/i.test(password)) {
        return 'Пароль не может быть последовательностью символов';
    }
    return null;
}


app.post('/api/register', (req, res) => {
    const { login, password } = req.body;
    console.log('📝 Регистрация:', login);
    
    if (!login || !password) {
        return res.status(400).json({ error: 'Заполни логин и пароль' });
    }

    if (login.length < 3) {
        return res.status(400).json({ error: 'Логин должен содержать не менее 3 символов' });
    }

    const pwdError = validatePassword(password);
    if (pwdError) {
        return res.status(400).json({ error: pwdError });
    }
    
    db.run(`INSERT INTO users (login, password) VALUES (?, ?)`, [login, password], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'Логин уже занят' });
            }
            return res.status(500).json({ error: 'Ошибка БД' });
        }
        console.log('✅ Пользователь создан:', login);
        res.json({ success: true, message: 'Регистрация успешна!' });
    });
});


app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    console.log('🔑 Вход:', login);
    
    db.get(`SELECT * FROM users WHERE login = ? AND password = ?`, [login, password], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка БД' });
        }
        if (user) {
            console.log('✅ Успешно:', login);
            res.json({ success: true, login: user.login, userId: user.id });
        } else {
            console.log('❌ Неверно:', login);
            res.status(401).json({ error: 'Неверный логин или пароль' });
        }
    });
});

app.get('/api/songs', (req, res) => {
    db.all(`SELECT * FROM songs ORDER BY plays DESC`, (err, songs) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка БД' });
        }
        res.json({ success: true, songs });
    });
});

app.get('/api/users/count', (req, res) => {
    db.get(`SELECT COUNT(*) as count FROM users`, (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка БД' });
        }
        res.json({ success: true, count: row.count });
    });
});

app.post('/api/play/:id', (req, res) => {
    const songId = req.params.id;
    console.log('🎵 Прослушивание трека ID:', songId);
    
    db.run(`UPDATE songs SET plays = plays + 1 WHERE id = ?`, [songId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Ошибка БД' });
        }
        db.get(`SELECT plays FROM songs WHERE id = ?`, [songId], (err, row) => {
            res.json({ success: true, plays: row ? row.plays : 0 });
        });
    });
});

app.get('/api/favorites/:userId', (req, res) => {
    const userId = req.params.userId;
    db.all(`
        SELECT s.* FROM songs s
        JOIN favorites f ON s.id = f.song_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
    `, [userId], (err, favorites) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка БД' });
        }
        res.json({ success: true, favorites });
    });
});

app.post('/api/favorites', (req, res) => {
    const { userId, songId } = req.body;
    console.log('⭐ Добавление в избранное:', { userId, songId });
    
    db.run(`INSERT INTO favorites (user_id, song_id) VALUES (?, ?)`, [userId, songId], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'Уже в избранном' });
            }
            return res.status(500).json({ error: 'Ошибка БД' });
        }
        res.json({ success: true, message: 'Добавлено в избранное' });
    });
});

app.delete('/api/favorites', (req, res) => {
    const { userId, songId } = req.body;
    console.log('💔 Удаление из избранного:', { userId, songId });
    
    db.run(`DELETE FROM favorites WHERE user_id = ? AND song_id = ?`, [userId, songId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Ошибка БД' });
        }
        res.json({ success: true, message: 'Удалено из избранного' });
    });
});

// Плейлисты
app.get('/api/playlists/:userId', (req, res) => {
    const userId = req.params.userId;
    db.all(`SELECT * FROM playlists WHERE user_id = ? ORDER BY created_at DESC`, [userId], (err, playlists) => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        // Для каждого плейлиста получаем список треков
        let done = 0;
        if (!playlists.length) return res.json({ success: true, playlists: [] });
        playlists.forEach(pl => {
            db.all(`SELECT song_id FROM playlist_songs WHERE playlist_id = ? ORDER BY added_at`, [pl.id], (err2, rows) => {
                pl.songIds = rows ? rows.map(r => r.song_id) : [];
                done++;
                if (done === playlists.length) res.json({ success: true, playlists });
            });
        });
    });
});

app.post('/api/playlists', (req, res) => {
    const { userId, name } = req.body;
    if (!userId || !name) return res.status(400).json({ error: 'Не указаны данные' });
    db.run(`INSERT INTO playlists (user_id, name) VALUES (?, ?)`, [userId, name], function(err) {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        res.json({ success: true, playlist: { id: this.lastID, name, songIds: [] } });
    });
});

app.delete('/api/playlists/:id', (req, res) => {
    const id = req.params.id;
    db.run(`DELETE FROM playlist_songs WHERE playlist_id = ?`, [id], err => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        db.run(`DELETE FROM playlists WHERE id = ?`, [id], err2 => {
            if (err2) return res.status(500).json({ error: 'Ошибка БД' });
            res.json({ success: true });
        });
    });
});

app.post('/api/playlists/:id/songs', (req, res) => {
    const playlistId = req.params.id;
    const { songId } = req.body;
    db.run(`INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id) VALUES (?, ?)`, [playlistId, songId], function(err) {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        res.json({ success: true });
    });
});

app.delete('/api/playlists/:id/songs', (req, res) => {
    const playlistId = req.params.id;
    const { songId } = req.body;
    db.run(`DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`, [playlistId, songId], err => {
        if (err) return res.status(500).json({ error: 'Ошибка БД' });
        res.json({ success: true });
    });
});

app.get('/api/test', (req, res) => {
    res.json({ message: 'OK' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log('\n Сервер запущен на http://localhost:3000\n');
});
