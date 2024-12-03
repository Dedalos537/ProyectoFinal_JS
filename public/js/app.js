const socket = io();

// Función para enviar mensaje
const sendMessage = () => {
    const msg = document.getElementById('msg').value;
    const username = document.getElementById('username').value;
    if (msg.trim()) {
        socket.emit('chat message', { username, message: msg });
        document.getElementById('msg').value = '';
    }
};

// Enviar mensaje al hacer clic en el botón
document.getElementById('send').addEventListener('click', sendMessage);

// Enviar mensaje al presionar Enter
document.getElementById('msg').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Evita que se añada un salto de línea
        sendMessage();
    }
});

// Cargar mensajes previos
socket.on('load messages', (messages) => {
    const chatWindow = document.getElementById('chat-window');
    messages.forEach(({ username, message, timestamp }) => {
        appendMessage(username, message, timestamp);
    });
});

// Recibir nuevos mensajes
socket.on('chat message', ({ username, message }) => {
    appendMessage(username, message, new Date());
});

// Función para agregar un mensaje con fecha y hora
function appendMessage(username, message, timestamp) {
    const chatWindow = document.getElementById('chat-window');
    const messageElement = document.createElement('div');
    messageElement.className = username === document.getElementById('username').value ? 'message me' : 'message other';

    const bubbleWrapper = document.createElement('div');
    bubbleWrapper.className = 'message-wrapper';

    const messageBubble = document.createElement('div');
    messageBubble.className = 'message-bubble';
    messageBubble.textContent = message;

    const usernameElement = document.createElement('div');
    usernameElement.className = 'username';
    usernameElement.textContent = username;

    const timestampElement = document.createElement('div');
    timestampElement.className = 'timestamp';
    timestampElement.textContent = formatDate(new Date(timestamp));

    bubbleWrapper.appendChild(usernameElement);
    bubbleWrapper.appendChild(messageBubble);
    bubbleWrapper.appendChild(timestampElement);

    messageElement.appendChild(bubbleWrapper);
    chatWindow.appendChild(messageElement);

    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Función para formatear la fecha
function formatDate(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Mostrar mensaje de conexión
socket.on('user connected', (username) => {
    const chatWindow = document.getElementById('chat-window');
    const notification = document.createElement('div');
    notification.className = 'notification connected';
    notification.textContent = `${username} se ha conectado al chat.`;
    chatWindow.appendChild(notification);
    chatWindow.scrollTop = chatWindow.scrollHeight;
});

// Mostrar mensaje de salida
socket.on('user disconnected', (username) => {
    const chatWindow = document.getElementById('chat-window');
    const notification = document.createElement('div');
    notification.className = 'notification disconnected';
    notification.textContent = `${username} ha salido del chat.`;
    chatWindow.appendChild(notification);
    chatWindow.scrollTop = chatWindow.scrollHeight;
});
// Obtener inicial del usuario y asignar al logo
const username = document.getElementById('username').value;
socket.emit('user connected', username);
document.getElementById('user-initial').textContent = username.charAt(0).toUpperCase();

// Redirigir al login al cerrar sesión
document.getElementById('logout').addEventListener('click', () => {
    socket.emit('chat message', { username, message: `${username}``ha salido del chat.` }); // Mensaje de salida
    socket.emit('user disconnected', username);  // Emitir evento de salida
    window.location.href = '/login';
});

let typingTimeout;
const chatWindow = document.getElementById('chat-window');
const currentUser = document.getElementById('username').value; // Nombre del usuario actual

// Mostrar indicador de escritura global
socket.on('userTyping', (data) => {
    const existingIndicator = document.getElementById(`typing-${data.username}`);
    if (!existingIndicator) {
        const newIndicator = document.createElement('div');
        newIndicator.className = `typing-indicator ${data.username === currentUser ? 'me' : 'other'}`;
        newIndicator.id = `typing-${data.username}`;
        newIndicator.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
        chatWindow.appendChild(newIndicator);
    }
});

// Eliminar indicador de escritura global
socket.on('userStoppedTyping', (data) => {
    const existingIndicator = document.getElementById(`typing-${data.username}`);
    if (existingIndicator) {
        chatWindow.removeChild(existingIndicator);
    }
});

// Función para notificar escritura
function notifyTyping() {
    socket.emit('typing', { username: currentUser });
}

// Función para notificar que se dejó de escribir
function notifyStoppedTyping() {
    socket.emit('stoppedTyping', { username: currentUser });
}

// Detectar actividad en el input
document.getElementById('msg').addEventListener('input', () => {
    clearTimeout(typingTimeout);
    notifyTyping();

    typingTimeout = setTimeout(() => {
        notifyStoppedTyping();
    }, 2000);
});




// Llama a simulateOtherUser Typing() cuando el otro usuario está escribiendo
// Animación de cierre de sesión
document.getElementById('logout').addEventListener('click', () => {
    const userNotification = document.createElement('div');
    userNotification.className = 'user-notification logout';
    userNotification.textContent = 'Saliendo...';
    document.getElementById('user-notifications').appendChild(userNotification);

    setTimeout(() => {
        socket.emit('user disconnected', username); // Emitir evento de salida
        window.location.href = '/login';
    }, 1000); // Tiempo para permitir la animación
});

// Evento para eliminar la notificación de "Usuario conectado" después de un tiempo
socket.on('user connected', (username) => {
    const chatWindow = document.getElementById('chat-window');
    const messageElement = document.createElement('div');
    messageElement.className = 'user-notification';
    const notification = document.createElement('div');
    notification.className = 'notification connected';
    notification.textContent = `${username} se ha conectado al chat.`;
    messageElement.appendChild(notification);
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    setTimeout(() => {
        chatWindow.removeChild(messageElement);
    }, 3000); // Tiempo antes de desaparecer la notificación
});
