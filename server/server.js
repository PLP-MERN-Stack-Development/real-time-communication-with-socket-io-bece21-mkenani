const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Initialize SQLite Database
const db = new sqlite3.Database(':memory:'); // Use ':memory:' for development or 'chat.db' for production

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Messages table with read receipts
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    message TEXT,
    room TEXT,
    type TEXT DEFAULT 'text',
    file_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Read receipts table
  db.run(`CREATE TABLE IF NOT EXISTS read_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER,
    username TEXT,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(message_id) REFERENCES messages(id)
  )`);

  // Message reactions table
  db.run(`CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER,
    username TEXT,
    emoji TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(message_id) REFERENCES messages(id)
  )`);
});

// Enhanced user storage with rooms
const users = new Map();
const rooms = ['general', 'random', 'tech', 'gaming'];

// Helper functions
const getUsersInRoom = (room) => {
  return Array.from(users.values())
    .filter(user => user.room === room)
    .map(user => user.username);
};

const getRoomUserCount = (room) => {
  return Array.from(users.values()).filter(user => user.room === room).length;
};

// Save message to database
const saveMessage = (messageData) => {
  return new Promise((resolve, reject) => {
    const { username, message, room, type = 'text', file_url = null } = messageData;
    
    db.run(
      `INSERT INTO messages (username, message, room, type, file_url) VALUES (?, ?, ?, ?, ?)`,
      [username, message, room, type, file_url],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
};

// Get message history for a room
const getMessageHistory = (room, limit = 50) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT m.*, 
              (SELECT COUNT(*) FROM read_receipts rr WHERE rr.message_id = m.id) as read_count,
              (SELECT GROUP_CONCAT(emoji) FROM reactions r WHERE r.message_id = m.id GROUP BY r.message_id) as reactions
       FROM messages m 
       WHERE m.room = ? 
       ORDER BY m.created_at DESC 
       LIMIT ?`,
      [room, limit],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.reverse()); // Return in chronological order
        }
      }
    );
  });
};

// Socket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user registration
  socket.on('register', (data) => {
    const { username, password } = data;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
      if (err) {
        socket.emit('register_error', 'Database error');
        return;
      }

      if (row) {
        socket.emit('register_error', 'Username already exists');
        return;
      }

      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, password], (err) => {
        if (err) {
          socket.emit('register_error', 'Registration failed');
          return;
        }

        socket.emit('register_success', 'Account created successfully');
        console.log(`New user registered: ${username}`);
      });
    });
  });

  // Handle user login and room join
  socket.on('user_join', async (data) => {
    const { username, password, room = 'general' } = data;

    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], async (err, row) => {
      if (err || !row) {
        socket.emit('auth_error', 'Invalid username or password');
        return;
      }

      // Store user data
      users.set(socket.id, {
        username,
        room,
        id: socket.id,
        joinedAt: new Date()
      });

      // Join the room
      socket.join(room);

      // Get message history for the room
      try {
        const messageHistory = await getMessageHistory(room);
        
        // Notify room that user joined
        socket.to(room).emit('user_joined', {
          username,
          message: `${username} joined the room`,
          timestamp: new Date().toLocaleTimeString(),
          userCount: getRoomUserCount(room)
        });

        // Send room info and history to the user
        socket.emit('room_joined', {
          room,
          users: getUsersInRoom(room),
          roomList: rooms.map(roomName => ({
            name: roomName,
            userCount: getRoomUserCount(roomName)
          })),
          messageHistory
        });

        // Update all clients with room user lists
        rooms.forEach(roomName => {
          io.to(roomName).emit('room_users_update', {
            room: roomName,
            users: getUsersInRoom(roomName),
            userCount: getRoomUserCount(roomName)
          });
        });

        console.log(`${username} joined room: ${room}`);
      } catch (error) {
        console.error('Error loading message history:', error);
        socket.emit('auth_error', 'Error loading chat history');
      }
    });
  });

  // Handle room switching
  socket.on('switch_room', async (newRoom) => {
    const user = users.get(socket.id);
    if (!user) return;

    const oldRoom = user.room;
    
    if (oldRoom === newRoom) return;

    // Leave old room
    socket.leave(oldRoom);
    
    // Notify old room
    socket.to(oldRoom).emit('user_left', {
      username: user.username,
      message: `${user.username} left the room`,
      timestamp: new Date().toLocaleTimeString(),
      userCount: getRoomUserCount(oldRoom)
    });

    // Join new room
    socket.join(newRoom);
    user.room = newRoom;

    // Get message history for new room
    try {
      const messageHistory = await getMessageHistory(newRoom);

      // Notify new room
      socket.to(newRoom).emit('user_joined', {
        username: user.username,
        message: `${user.username} joined the room`,
        timestamp: new Date().toLocaleTimeString(),
        userCount: getRoomUserCount(newRoom)
      });

      // Send new room info and history to user
      socket.emit('room_joined', {
        room: newRoom,
        users: getUsersInRoom(newRoom),
        roomList: rooms.map(roomName => ({
          name: roomName,
          userCount: getRoomUserCount(roomName)
        })),
        messageHistory
      });

      // Update room lists for all clients
      rooms.forEach(roomName => {
        io.to(roomName).emit('room_users_update', {
          room: roomName,
          users: getUsersInRoom(roomName),
          userCount: getRoomUserCount(roomName)
        });
      });

      console.log(`${user.username} switched from ${oldRoom} to ${newRoom}`);
    } catch (error) {
      console.error('Error loading message history:', error);
    }
  });

  // Handle chat messages with persistence
  socket.on('send_message', async (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    try {
      const messageId = await saveMessage({
        username: user.username,
        message: data.message,
        room: user.room,
        type: data.type || 'text',
        file_url: data.file_url
      });

      const messageData = {
        id: messageId,
        username: user.username,
        message: data.message,
        timestamp: new Date().toLocaleTimeString(),
        room: user.room,
        type: data.type || 'text',
        file_url: data.file_url,
        read_count: 0,
        reactions: null
      };

      // Send to users in the same room
      io.to(user.room).emit('receive_message', messageData);
      console.log(`Message in ${user.room} from ${user.username}: ${data.message}`);
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('message_error', 'Failed to send message');
    }
  });

  // Handle read receipts
  socket.on('message_read', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const { message_id } = data;

    db.run(
      'INSERT OR IGNORE INTO read_receipts (message_id, username) VALUES (?, ?)',
      [message_id, user.username],
      function(err) {
        if (!err) {
          // Notify others in the room that message was read
          socket.to(user.room).emit('message_read_update', {
            message_id,
            username: user.username,
            read_count: this.changes
          });
        }
      }
    );
  });

  // Handle message reactions
  socket.on('add_reaction', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const { message_id, emoji } = data;

    db.run(
      'INSERT OR REPLACE INTO reactions (message_id, username, emoji) VALUES (?, ?, ?)',
      [message_id, user.username, emoji],
      function(err) {
        if (!err) {
          // Broadcast reaction to room
          io.to(user.room).emit('reaction_added', {
            message_id,
            username: user.username,
            emoji
          });
        }
      }
    );
  });

  // Handle typing indicators
  socket.on('typing_start', () => {
    const user = users.get(socket.id);
    if (!user) return;

    socket.to(user.room).emit('user_typing', {
      username: user.username,
      room: user.room
    });
  });

  socket.on('typing_stop', () => {
    const user = users.get(socket.id);
    if (!user) return;

    socket.to(user.room).emit('user_stopped_typing', {
      username: user.username,
      room: user.room
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (!user) return;

    users.delete(socket.id);

    // Notify room that user left
    socket.to(user.room).emit('user_left', {
      username: user.username,
      message: `${user.username} left the room`,
      timestamp: new Date().toLocaleTimeString(),
      userCount: getRoomUserCount(user.room)
    });

    // Update room lists
    rooms.forEach(roomName => {
      io.to(roomName).emit('room_users_update', {
        room: roomName,
        users: getUsersInRoom(roomName),
        userCount: getRoomUserCount(roomName)
      });
    });

    console.log(`User disconnected: ${user.username} from ${user.room}`);
  });
});

// API endpoints
app.get('/api/rooms', (req, res) => {
  const roomData = rooms.map(room => ({
    name: room,
    userCount: getRoomUserCount(room)
  }));
  res.json(roomData);
});

// Search messages
app.get('/api/messages/search', (req, res) => {
  const { room, query } = req.query;
  
  if (!room || !query) {
    return res.status(400).json({ error: 'Room and query parameters required' });
  }

  db.all(
    `SELECT * FROM messages 
     WHERE room = ? AND message LIKE ? 
     ORDER BY created_at DESC 
     LIMIT 20`,
    [room, `%${query}%`],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: 'Search failed' });
      } else {
        res.json(rows);
      }
    }
  );
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Available rooms:', rooms);
});