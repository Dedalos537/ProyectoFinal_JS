const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise');

const app = express();
const port = 3000;

// Configuración de la base de datos
const dbConfig = {
    host: 'junction.proxy.rlwy.net', // Host de la base de datos
    user: 'root',                    // Usuario
    password: 'wdbUQezLEyfCQegYncwiUfAymfLtWzLG', // Contraseña
    database: 'railway',             // Nombre de la base de datos
    port: 57790                      // Puerto de conexión
};


// Configuración de EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'secretKey',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, secure: false }
}));

// Función para conectarse a la base de datos
const connectDB = async () => {
    return await mysql.createConnection(dbConfig);
};
const initializeDatabase = async () => {
    const db = await connectDB();
    // Crear tabla de usuarios si no existe
    await db.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            passwordHash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // Crear tabla de mensajes si no existe
    await db.execute(`
        CREATE TABLE IF NOT EXISTS messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE ON UPDATE CASCADE
        )
    `);
    await db.end();
};

// Llama a la función al iniciar el servidor
initializeDatabase().catch(err => {
    console.error('Error inicializando la base de datos:', err);
});


// Rutas
app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const db = await connectDB();
        const [rows] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        await db.end();

        if (rows.length > 0 && bcrypt.compareSync(password, rows[0].passwordHash)) {
            req.session.username = username;
            return res.redirect('/chat');
        }

        res.render('login', { error: 'Credenciales incorrectas' });
    } catch (err) {
        console.error('Error procesando el login:', err);
        res.status(500).send('Error interno del servidor');
    }
});

app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
    const { username, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        return res.render('register', { error: 'Las contraseñas no coinciden' });
    }

    try {
        const db = await connectDB();
        const [existingUser] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);

        if (existingUser.length > 0) {
            await db.end();
            return res.render('register', { error: 'El nombre de usuario ya está en uso' });
        }

        const passwordHash = bcrypt.hashSync(password, 10);
        await db.execute('INSERT INTO users (username, passwordHash) VALUES (?, ?)', [username, passwordHash]);
        await db.end();

        res.redirect('/login');
    } catch (err) {
        console.error('Error procesando el registro:', err);
        res.status(500).send('Error interno del servidor');
    }
});

app.get('/chat', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }
    res.render('chat', { username: req.session.username });
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// Iniciar el servidor
const server = app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});

// Configuración de Socket.IO
const io = socketIo(server);

io.on('connection', async (socket) => {
    console.log('Nuevo usuario conectado');
    const db = await connectDB();
    const [messages] = await db.execute('SELECT * FROM messages ORDER BY timestamp ASC');
    socket.emit('load messages', messages);

    socket.on('chat message', async ({ username, message }) => {
        const db = await connectDB();
        await db.execute('INSERT INTO messages (username, message) VALUES (?, ?)', [username, message]);
        const newMessage = { username, message, timestamp: new Date() };
        io.emit('chat message', newMessage);
        await db.end();
    });
    // Manejar evento de escritura
    socket.on('typing', (data) => {
        socket.broadcast.emit('userTyping', data); // Notificar a todos excepto al remitente
    });

    // Manejar evento de detener escritura
    socket.on('stoppedTyping', (data) => {
        socket.broadcast.emit('userStoppedTyping', data); // Notificar a todos excepto al remitente
    });
    socket.on('disconnect', () => {
        console.log('Usuario desconectado');
    });

});
