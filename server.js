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

app.get('/api/test', (req, res) => {
    res.json({ message: 'OK' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log('\n✅ Сервер запущен на http://localhost:3000\n');
});
