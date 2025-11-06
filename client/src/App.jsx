import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { 
  Sun, Moon, Send, Users, Wifi, WifiOff, LogOut, 
  MessageSquare, Search, Smile, Paperclip, CheckCheck 
} from 'lucide-react';

const socket = io('http://localhost:5000');

// Emoji picker component
const EmojiPicker = ({ onEmojiSelect, onClose }) => {
  const emojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];

  return (
    <div className="absolute bottom-12 left-0 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-2xl p-3 z-50">
      <div className="grid grid-cols-4 gap-2">
        {emojis.map(emoji => (
          <button
            key={emoji}
            onClick={() => onEmojiSelect(emoji)}
            className="text-2xl hover:scale-125 transition-transform p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            {emoji}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full mt-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
      >
        Close
      </button>
    </div>
  );
};

function App() {
  // Authentication states
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Chat states
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [isTyping, setIsTyping] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return JSON.parse(saved);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mark messages as read when they become visible
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.username !== username) {
      socket.emit('message_read', { message_id: lastMessage.id });
    }
  }, [messages, username]);

  // Theme Management
  useEffect(() => {
    const root = document.documentElement;
    
    if (darkMode) {
      root.classList.add('dark');
      root.style.setProperty('color-scheme', 'dark');
    } else {
      root.classList.remove('dark');
      root.style.setProperty('color-scheme', 'light');
    }
    
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Socket event listeners
  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('receive_message', (data) => {
      if (data.room === currentRoom) {
        setMessages(prev => [...prev, { ...data, id: data.id || Date.now() }]);
      }
    });

    socket.on('room_joined', (data) => {
      setCurrentRoom(data.room);
      setUsers(data.users);
      setRooms(data.roomList);
      setMessages(data.messageHistory || []);
    });

    socket.on('room_users_update', (data) => {
      if (data.room === currentRoom) {
        setUsers(data.users);
      }
      setRooms(prev => prev.map(room => 
        room.name === data.room 
          ? { ...room, userCount: data.userCount }
          : room
      ));
    });

    socket.on('user_typing', (data) => {
      if (data.room === currentRoom) {
        setIsTyping(`${data.username} is typing...`);
        setTimeout(() => setIsTyping(''), 3000);
      }
    });

    socket.on('user_stopped_typing', () => {
      setIsTyping('');
    });

    socket.on('user_joined', (data) => {
      if (data.room === currentRoom) {
        setMessages(prev => [...prev, {
          username: 'System',
          message: data.message,
          timestamp: data.timestamp,
          id: Date.now(),
          type: 'system'
        }]);
      }
    });

    socket.on('user_left', (data) => {
      if (data.room === currentRoom) {
        setMessages(prev => [...prev, {
          username: 'System',
          message: data.message,
          timestamp: data.timestamp,
          id: Date.now(),
          type: 'system'
        }]);
      }
    });

    // Read receipt updates
    socket.on('message_read_update', (data) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.message_id 
          ? { ...msg, read_count: (msg.read_count || 0) + 1 }
          : msg
      ));
    });

    // Reaction updates
    socket.on('reaction_added', (data) => {
      setMessages(prev => prev.map(msg => {
        if (msg.id === data.message_id) {
          const currentReactions = msg.reactions ? msg.reactions.split(',') : [];
          if (!currentReactions.includes(data.emoji)) {
            currentReactions.push(data.emoji);
          }
          return { ...msg, reactions: currentReactions.join(',') };
        }
        return msg;
      }));
    });

    // Authentication events
    socket.on('register_success', (message) => {
      alert(message);
      setIsLogin(true);
      setPassword('');
    });

    socket.on('register_error', (error) => {
      alert(error);
    });

    socket.on('auth_error', (error) => {
      alert(error);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('receive_message');
    };
  }, [currentRoom]);

  // Authentication handlers
  const handleRegister = (e) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      socket.emit('register', { username, password });
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      socket.emit('user_join', { username, password, room: currentRoom });
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setMessages([]);
    setUsers([]);
    socket.disconnect();
    socket.connect();
  };

  // Room handlers
  const switchRoom = (roomName) => {
    if (roomName !== currentRoom) {
      socket.emit('switch_room', roomName);
    }
  };

  // Message handlers
  const sendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      socket.emit('send_message', { message });
      setMessage('');
      socket.emit('typing_stop');
      setShowEmojiPicker(false);
    }
  };

  const handleTyping = () => {
    if (message.trim()) {
      socket.emit('typing_start');
    } else {
      socket.emit('typing_stop');
    }
  };

  const addReaction = (messageId, emoji) => {
    socket.emit('add_reaction', { message_id: messageId, emoji });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // In a real app, you would upload the file to a server
      // For now, we'll just send a message about the file
      const fileMessage = `📎 Uploaded file: ${file.name}`;
      socket.emit('send_message', { 
        message: fileMessage, 
        type: 'file',
        file_url: URL.createObjectURL(file)
      });
    }
  };

  const toggleTheme = () => {
    setDarkMode(prev => !prev);
  };

  // Filter messages based on search
  const filteredMessages = searchQuery 
    ? messages.filter(msg => 
        msg.message.toLowerCase().includes(searchQuery.toLowerCase()) &&
        msg.type !== 'system'
      )
    : messages;

  // Connection status component
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-[#0f172a] dark:to-[#1e293b] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl text-center">
          <WifiOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
            Connecting to Chat...
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Please ensure the server is running on port 5000
          </p>
        </div>
      </div>
    );
  }

  // Authentication screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-[#0f172a] dark:to-[#1e293b] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl w-full max-w-md">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              aria-label="Toggle theme"
            >
              {darkMode ? (
                <Sun className="w-5 h-5 text-yellow-500" />
              ) : (
                <Moon className="w-5 h-5 text-gray-700" />
              )}
            </button>
          </div>

          {/* Auth Toggle */}
          <div className="flex mb-6 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-md transition-all ${
                isLogin 
                  ? 'bg-white dark:bg-slate-600 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-md transition-all ${
                !isLogin 
                  ? 'bg-white dark:bg-slate-600 shadow-sm' 
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              Register
            </button>
          </div>
          
          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-all"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white transition-all"
                required
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
            >
              {isLogin ? 'Login to Chat' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-gray-600 dark:text-gray-400 mt-4">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {isLogin ? 'Register' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Main chat interface
  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      darkMode 
        ? 'bg-gradient-to-br from-[#0f172a] to-[#1e293b]' 
        : 'bg-gradient-to-br from-blue-50 to-indigo-100'
    }`}>
      <div className="container mx-auto h-screen p-4 flex flex-col">
        {/* Header */}
        <header className={`rounded-2xl p-4 mb-4 shadow-lg transition-colors duration-300 ${
          darkMode ? 'bg-slate-800' : 'bg-white'
        }`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Wifi className={`w-4 h-4 ${isConnected ? 'text-green-500' : 'text-red-500'}`} />
                <span className={`text-sm font-medium transition-colors duration-300 ${
                  darkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div>
                <h1 className={`text-xl font-bold transition-colors duration-300 ${
                  darkMode ? 'text-white' : 'text-gray-800'
                }`}>
                  #{currentRoom}
                </h1>
                <p className={`text-sm transition-colors duration-300 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {users.length} users online
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search Toggle */}
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`p-2 rounded-lg transition-colors duration-300 ${
                  darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <Search className="w-4 h-4" />
              </button>
              
              <div className={`text-sm transition-colors duration-300 ${
                darkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                Welcome, <span className={`font-semibold ${
                  darkMode ? 'text-blue-400' : 'text-blue-600'
                }`}>{username}</span>
              </div>
              
              <button
                onClick={handleLogout}
                className={`p-2 rounded-lg transition-colors duration-300 ${
                  darkMode 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-red-500 hover:bg-red-600'
                } text-white`}
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
              
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition-colors duration-300 ${
                  darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'
                }`}
                aria-label="Toggle theme"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-700" />
                )}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          {showSearch && (
            <div className="mt-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-700 dark:text-white"
              />
              {searchQuery && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Found {filteredMessages.filter(m => m.type !== 'system').length} messages
                </p>
              )}
            </div>
          )}
        </header>

        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Sidebar with Rooms and Users */}
          <div className={`lg:w-80 rounded-2xl p-6 shadow-lg hidden lg:block transition-colors duration-300 ${
            darkMode ? 'bg-slate-800' : 'bg-white'
          }`}>
            {/* Rooms Section */}
            <div className="mb-8">
              <div className="flex items-center space-x-2 mb-4">
                <MessageSquare className={`w-5 h-5 transition-colors duration-300 ${
                  darkMode ? 'text-blue-400' : 'text-blue-600'
                }`} />
                <h2 className={`text-lg font-semibold transition-colors duration-300 ${
                  darkMode ? 'text-white' : 'text-gray-800'
                }`}>
                  Chat Rooms
                </h2>
              </div>
              
              <div className="space-y-2">
                {rooms.map((room) => (
                  <button
                    key={room.name}
                    onClick={() => switchRoom(room.name)}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-300 ${
                      currentRoom === room.name
                        ? darkMode
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-500 text-white'
                        : darkMode
                        ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium">#{room.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        currentRoom === room.name
                          ? 'bg-white bg-opacity-20'
                          : darkMode
                          ? 'bg-slate-600'
                          : 'bg-gray-300'
                      }`}>
                        {room.userCount}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Online Users Section */}
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Users className={`w-5 h-5 transition-colors duration-300 ${
                  darkMode ? 'text-blue-400' : 'text-blue-600'
                }`} />
                <h2 className={`text-lg font-semibold transition-colors duration-300 ${
                  darkMode ? 'text-white' : 'text-gray-800'
                }`}>
                  Online Users ({users.length})
                </h2>
              </div>
              
              <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                {users.map((user, index) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-3 p-3 rounded-xl transition-colors duration-300 ${
                      darkMode ? 'bg-slate-700' : 'bg-gray-100'
                    }`}
                  >
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className={`font-medium transition-colors duration-300 ${
                      darkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {user}
                    </span>
                    {user === username && (
                      <span className={`text-xs px-2 py-1 rounded-full transition-colors duration-300 ${
                        darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                      }`}>
                        You
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col rounded-2xl shadow-lg overflow-hidden transition-colors duration-300 ${
            darkMode ? 'bg-slate-800' : 'bg-white'
          }`}>
            {/* Room Header */}
            <div className={`p-4 border-b transition-colors duration-300 ${
              darkMode ? 'border-slate-600' : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-lg font-bold transition-colors duration-300 ${
                  darkMode ? 'text-white' : 'text-gray-800'
                }`}>
                  #{currentRoom} {searchQuery && `- Search: "${searchQuery}"`}
                </h2>
                <span className={`text-sm transition-colors duration-300 ${
                  darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {users.length} users in room
                </span>
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 p-6 overflow-y-auto scrollbar-thin">
              <div className="space-y-4">
                {filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.username === username ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl transition-colors duration-300 relative group ${
                        msg.type === 'system'
                          ? darkMode 
                            ? 'bg-yellow-900 text-yellow-200 mx-auto text-center text-sm'
                            : 'bg-yellow-100 text-yellow-800 mx-auto text-center text-sm'
                          : msg.username === username
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-br-none'
                          : darkMode
                          ? 'bg-slate-700 text-white rounded-bl-none'
                          : 'bg-gray-100 text-gray-800 rounded-bl-none'
                      }`}
                    >
                      {msg.type !== 'system' && msg.username !== username && (
                        <div className={`font-semibold text-sm mb-1 transition-colors duration-300 ${
                          darkMode ? 'text-blue-400' : 'text-blue-600'
                        }`}>
                          {msg.username}
                        </div>
                      )}
                      
                      <div className="break-words">{msg.message}</div>
                      
                      {/* Message footer with timestamp and status */}
                      <div className="flex items-center justify-between mt-2">
                        <div
                          className={`text-xs transition-colors duration-300 ${
                            msg.type === 'system'
                              ? darkMode
                                ? 'text-yellow-300'
                                : 'text-yellow-600'
                              : msg.username === username
                              ? 'text-blue-100'
                              : darkMode
                              ? 'text-gray-400'
                              : 'text-gray-500'
                          }`}
                        >
                          {msg.timestamp}
                        </div>
                        
                        {/* Read receipts */}
                        {msg.username === username && msg.read_count > 0 && (
                          <div className="flex items-center space-x-1 ml-2">
                            <CheckCheck className="w-3 h-3 text-blue-300" />
                            <span className="text-xs text-blue-300">{msg.read_count}</span>
                          </div>
                        )}
                      </div>

                      {/* Reactions */}
                      {msg.reactions && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {msg.reactions.split(',').map((emoji, index) => (
                            <span
                              key={index}
                              className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full"
                            >
                              {emoji}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Reaction button (hover) */}
                      {msg.type !== 'system' && (
                        <button
                          onClick={() => addReaction(msg.id, '👍')}
                          className="absolute -bottom-2 -right-2 opacity-0 group-hover:opacity-100 bg-white dark:bg-slate-800 rounded-full p-1 shadow-lg transition-all duration-300"
                        >
                          <Smile className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start">
                    <div className={`px-4 py-2 rounded-2xl rounded-bl-none text-sm italic transition-colors duration-300 ${
                      darkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isTyping}
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <form onSubmit={sendMessage} className={`p-4 border-t transition-colors duration-300 ${
              darkMode ? 'border-slate-600' : 'border-gray-200'
            }`}>
              <div className="flex space-x-2">
                {/* File upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-3 rounded-xl transition-colors duration-300 ${
                    darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Emoji picker button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`p-3 rounded-xl transition-colors duration-300 ${
                      darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                  
                  {showEmojiPicker && (
                    <EmojiPicker
                      onEmojiSelect={(emoji) => {
                        setMessage(prev => prev + emoji);
                        setShowEmojiPicker(false);
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>

                <input
                  type="text"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    handleTyping();
                  }}
                  placeholder={`Message #${currentRoom}`}
                  className={`flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ${
                    darkMode 
                      ? 'bg-slate-700 border-slate-600 text-white' 
                      : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                />
                
                <button
                  type="submit"
                  disabled={!message.trim()}
                  className="px-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Mobile Rooms Button */}
        <div className="lg:hidden fixed bottom-6 right-6">
          <button className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all">
            <MessageSquare className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;