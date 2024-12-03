from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_socketio import SocketIO, emit
import pymysql
pymysql.install_as_MySQLdb()
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
import jsonx

# Configuración de Flask y la base de datos
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql://root:@localhost/chat_db'
db = SQLAlchemy(app)
socketio = SocketIO(app)

# Configuración de Flask-Login
login_manager = LoginManager(app)
login_manager.login_view = 'login'

# Modelo de Usuario
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    messages = db.relationship('Message', backref='user', lazy=True)

# Modelo de Mensajes
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())

# Rutas de la aplicación

# Página de chat
@app.route('/chat')
@login_required
def chat():
    messages = Message.query.order_by(Message.timestamp).all()
    return render_template('chat.html', messages=messages)

# Página de registro
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()  # Obtiene los datos JSON enviados
    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({"message": "Faltan campos obligatorios"}), 400
    
    hashed_password = generate_password_hash(password, method='sha256')
    user = User(username=username, password=hashed_password)
    db.session.add(user)
    db.session.commit()
    flash("Registro exitoso. Por favor, inicie sesión.", "success")
    return jsonify({"message": "Registro exitoso"}), 200

# Página de login
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()  # Obtiene los datos JSON enviados
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"message": "Faltan campos obligatorios"}), 400

    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password, password):
        login_user(user)
        return jsonify({"message": "Inicio de sesión exitoso"}), 200
    else:
        return jsonify({"message": "Credenciales incorrectas"}), 401

# Evento de conexión de clientes
@socketio.on('connect')
def handle_connect():
    print(f"Usuario conectado: {request.sid}")

# Evento de recepción de mensajes
@socketio.on('chat message')
def handle_chat_message(data):
    message = data['message']
    user = current_user
    new_message = Message(user_id=user.id, message=message)
    db.session.add(new_message)
    db.session.commit()
    emit('chat message', {'username': user.username, 'msg': message}, broadcast=True)

# Función para cargar al usuario
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Ruta para hacer logout
@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # Crear las tablas en la base de datos
    socketio.run(app, debug=True)
