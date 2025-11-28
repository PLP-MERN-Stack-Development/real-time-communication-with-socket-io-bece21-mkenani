import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import {
  Sun, Moon, Send, Users, Wifi, WifiOff, LogOut,
  MessageSquare, Search, Smile, Paperclip, CheckCheck
} from 'lucide-react';

const API_URL = import.meta.env.VITE_APP_SOCKET_URL;
const socket = io(API_URL);

// Emoji picker component — now accepts position class
const EmojiPicker = ({ onEmojiSelect, onClose, position = 'left-0' }) => {
  const emojis = [
    '👍', '❤️', '😂', '😮', '😢', '😡', '🙌', '🔥', '💯', '👀',
    '🚀', '🤔', '🎉', '💀', '👏', '🤯', '🤩', '🥳', '🤝', '✨'
  ];

  return (
    <div className={`absolute ${position} bottom-14 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-2xl shadow-2xl p-4 z-50 w-80 md:w-96`}>
      <div className="grid grid-cols-8 gap-3">
        {emojis.map(emoji => (
          <button
            key={emoji}
            onClick={() => onEmojiSelect(emoji)}
            className="text-2xl hover:scale-150 transition-transform p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            {emoji}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-center"
      >
        Close
      </button>
    </div>
  );
};

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
  const [showMobileRooms, setShowMobileRooms] = useState(false);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return JSON.parse(saved);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

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
      setIsAuthenticated(true);
      setPassword('');
      setUsername(data.username || username);
    });

    socket.on('room_users_update', (data) => {
      if (data.room === currentRoom) setUsers(data.users);
      setRooms(prev => prev.map(room =>
        room.name === data.room ? { ...room, userCount: data.userCount } : room
      ));
    });

    socket.on('user_typing', (data) => {
      if (data.room === currentRoom) {
        setIsTyping(`${data.username} is typing...`);
        setTimeout(() => setIsTyping(''), 3000);
      }
    });

    socket.on('user_stopped_typing', () => setIsTyping(''));

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

    socket.on('message_read_update', (data) => {
      setMessages(prev => prev.map(msg =>
        msg.id === data.message_id
          ? { ...msg, read_count: (msg.read_count || 0) + 1 }
          : msg
      ));
    });

    socket.on('reaction_added', (data) => {
      setMessages(prev => prev.map(msg => {
        if (msg.id === data.message_id) {
          const currentReactions = msg.reactions ? msg.reactions.split(',') : [];
          if (!currentReactions.includes(data.emoji)) currentReactions.push(data.emoji);
          return { ...msg, reactions: currentReactions.join(',') };
        }
        return msg;
      }));
    });

    socket.on('register_success', (message) => {
      alert(message);
      setIsLogin(true);
      setPassword('');
    });

    socket.on('register_error', alert);
    socket.on('auth_error', (error) => {
      alert(error);
      setIsAuthenticated(false);
    });

    return () => { socket.off(); };
  }, [currentRoom, username]);

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
    }
  };

  const handleLogout = () => {
    socket.emit('user_leave', { room: currentRoom });
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
    setMessages([]);
    setUsers([]);
    setRooms([]);
    setCurrentRoom('general');
    socket.disconnect();
    setTimeout(() => socket.connect(), 500);
  };

  const switchRoom = (roomName) => {
    if (roomName !== currentRoom) {
      socket.emit('switch_room', roomName);
      setShowMobileRooms(false);
    }
  };

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
    socket.emit(message.trim() ? 'typing_start' : 'typing_stop');
  };

  const addReaction = (messageId, emoji) => {
    socket.emit('add_reaction', { message_id: messageId, emoji });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      socket.emit('send_message', {
        message: `📎 ${file.name}`,
        type: 'file',
        file_url: URL.createObjectURL(file)
      });
    }
  };

  const toggleTheme = () => setDarkMode(prev => !prev);

  const filteredMessages = searchQuery
    ? messages.filter(msg => msg.message.toLowerCase().includes(searchQuery.toLowerCase()) && msg.type !== 'system')
    : messages;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-[#0f172a] dark:to-[#1e293b] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl text-center">
          <WifiOff className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Connecting...</h1>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-[#0f172a] dark:to-[#1e293b] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl w-full max-w-md">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <button onClick={toggleTheme} className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
              {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
            </button>
          </div>

          <div className="flex mb-6 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
            <button onClick={() => setIsLogin(true)} className={`flex-1 py-2 px-4 rounded-md transition-all ${isLogin ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>Login</button>
            <button onClick={() => setIsLogin(false)} className={`flex-1 py-2 px-4 rounded-md transition-all ${!isLogin ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}>Register</button>
          </div>

          <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" required />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" required />
            <button type="submit" className="w-full bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg">
              {isLogin ? 'Login to Chat' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-linear-to-br from-[#0f172a] to-[#1e293b]' : 'bg-linear-to-br from-blue-50 to-indigo-100'}`}>
      <div className="container mx-auto h-screen p-4 flex flex-col">
        {/* Header */}
        <header className={`rounded-2xl p-4 mb-4 shadow-lg ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Wifi className={`w-4 h-4 ${isConnected ? 'text-green-500' : 'text-red-500'}`} />
              <div className="hidden md:block">
                <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{currentRoom} Group</h1>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{users.length} online</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => setShowSearch(s => !s)} className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                <Search className="w-4 h-4" />
              </button>
              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Welcome, <strong className={darkMode ? 'text-blue-400' : 'text-blue-600'}>{username}</strong></span>
              <button onClick={handleLogout} className={`p-2 rounded-lg ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}>
                <LogOut className="w-4 h-4" />
              </button>
              <button onClick={toggleTheme} className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                {darkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-gray-700" />}
              </button>
            </div>
          </div>
          {showSearch && (
            <div className="mt-4">
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search messages..." className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white" />
            </div>
          )}
        </header>

        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Sidebar */}
          <aside className={`lg:w-80 rounded-2xl p-6 shadow-lg hidden lg:block ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="mb-8">
              <div className="flex items-center space-x-2 mb-4">
                <MessageSquare className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Rooms</h2>
              </div>
              <div className="space-y-2">
                {rooms.map((room) => (
                  <button key={room.name} onClick={() => switchRoom(room.name)} className={`w-full text-left p-3 rounded-xl transition-all ${currentRoom === room.name ? 'bg-blue-600 text-white' : darkMode ? 'bg-slate-700 hover:bg-slate-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                    <div className="flex justify-between">
                      <span className="font-medium">{room.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${currentRoom === room.name ? 'bg-white/20' : darkMode ? 'bg-slate-600' : 'bg-gray-300'}`}>{room.userCount || 0}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Users className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <h2 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Online ({users.length})</h2>
              </div>
              <div className="space-y-2">
                {users.map((user) => (
                  <div key={user} className={`flex items-center space-x-3 p-3 rounded-xl ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{user}</span>
                    {user === username && <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'}`}>You</span>}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Chat Area */}
          <main className={`flex-1 flex flex-col rounded-2xl shadow-lg overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className={`p-4 border-b ${darkMode ? 'border-slate-600' : 'border-gray-200'}`}>
              <div className="flex justify-between items-center">
                <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{currentRoom}</h2>
                <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{users.length} in room</span>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto scrollbar-thin">
              <div className="space-y-4">
                {filteredMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.username === username ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl relative group ${msg.type === 'system' ? 'bg-yellow-900/70 text-yellow-200 dark:bg-yellow-900/70 mx-auto text-center text-sm' : msg.username === username ? 'bg-linear-to-r from-blue-500 to-indigo-500 text-white rounded-br-none' : darkMode ? 'bg-slate-700 text-white rounded-bl-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                      {msg.type !== 'system' && msg.username !== username && (
                        <div className={`font-semibold text-sm mb-1 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>{msg.username}</div>
                      )}
                      <div className="wrap-break-word">{msg.message}</div>
                      <div className="flex justify-between items-center mt-2 text-xs opacity-80">
                        <span>{msg.timestamp}</span>
                        {msg.username === username && msg.read_count > 0 && (
                          <span className="flex items-center gap-1">
                            <CheckCheck className="w-3 h-3" />
                            {msg.read_count}
                          </span>
                        )}
                      </div>
                      {msg.reactions && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {msg.reactions.split(',').map((e, i) => (
                            <span key={i} className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">{e}</span>
                          ))}
                        </div>
                      )}
                      {msg.type !== 'system' && (
                        <button onClick={() => addReaction(msg.id, '👍')} className="absolute -bottom-3 -right-3 opacity-0 group-hover:opacity-100 bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg transition-all">
                          <Smile className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className={`px-4 py-2 rounded-2xl ${darkMode ? 'bg-slate-700 text-gray-400' : 'bg-gray-100 text-gray-600'} text-sm italic`}>
                    {isTyping}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={sendMessage} className={`p-4 border-t ${darkMode ? 'border-slate-600' : 'border-gray-200'} relative`}>
              {/* Desktop Input */}
              <div className="hidden md:flex items-center space-x-3">
                <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  <Paperclip className="w-5 h-5" />
                </button>

                <div className="relative">
                  <button type="button" onClick={() => setShowEmojiPicker(v => !v)} className={`p-3 rounded-xl ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                    <Smile className="w-5 h-5" />
                  </button>
                  {showEmojiPicker && (
                    <EmojiPicker
                      position="left-0"
                      onEmojiSelect={(emoji) => {
                        setMessage(m => m + emoji);
                        setShowEmojiPicker(false);
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>

                <input
                  type="text"
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); handleTyping(); }}
                  placeholder={`Message in ${currentRoom}`}
                  className={`flex-1 px-5 py-3 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-50 border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                />

                <button type="submit" disabled={!message.trim()} className="px-6 py-3 bg-linear-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 flex items-center gap-2">
                  <Send className="w-5 h-5" /> Send
                </button>
              </div>

              {/* Mobile Input */}
              <div className="md:hidden flex items-center">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => { setMessage(e.target.value); handleTyping(); }}
                    placeholder={`Message in ${currentRoom}`}
                    className={`w-full px-5 py-4 pr-32 rounded-xl border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-gray-50 border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:outline-none`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-2 rounded-lg ${darkMode ? 'bg-slate-600' : 'bg-gray-200'}`}>
                      <Paperclip className="w-5 h-5" />
                    </button>

                    <div className="relative">
                      <button type="button" onClick={() => setShowEmojiPicker(v => !v)} className={`p-2 rounded-lg ${darkMode ? 'bg-slate-600' : 'bg-gray-200'}`}>
                        <Smile className="w-5 h-5" />
                      </button>
                      {showEmojiPicker && (
                        <EmojiPicker
                          position="right-0"
                          onEmojiSelect={(emoji) => {
                            setMessage(m => m + emoji);
                            setShowEmojiPicker(false);
                          }}
                          onClose={() => setShowEmojiPicker(false)}
                        />
                      )}
                    </div>

                    <button type="submit" disabled={!message.trim()} className={`p-2 rounded-lg ${message.trim() ? 'bg-linear-to-r from-blue-600 to-indigo-600 text-white' : darkMode ? 'bg-slate-600' : 'bg-gray-300'}`}>
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
            </form>
          </main>
        </div>

        {/* Mobile Rooms Button */}
        <button onClick={() => setShowMobileRooms(v => !v)} className="lg:hidden fixed bottom-20 right-6 bg-linear-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-full shadow-2xl z-40 hover:scale-110 transition-transform">
          <MessageSquare className="w-7 h-7" />
        </button>

        {/* Mobile Rooms Panel */}
        {showMobileRooms && (
          <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setShowMobileRooms(false)}>
            <div className={`absolute right-0 top-16 bottom-0 w-80 rounded-l-2xl p-6 shadow-2xl overflow-y-auto ${darkMode ? 'bg-slate-800' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
              <div className="mb-8">
                <h2 className={`text-lg font-semibold flex items-center gap-2 mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  <MessageSquare className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} /> Rooms
                </h2>
                {rooms.map((room) => (
                  <button key={room.name} onClick={() => { switchRoom(room.name); setShowMobileRooms(false); }} className={`w-full text-left p-4 rounded-xl mb-2 transition-all ${currentRoom === room.name ? 'bg-blue-600 text-white' : darkMode ? 'bg-slate-700 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{room.name}</span>
                      <span className={`text-xs px-3 py-1 rounded-full ${currentRoom === room.name ? 'bg-white/20' : darkMode ? 'bg-slate-600' : 'bg-gray-300'}`}>{room.userCount || 0}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <h2 className={`text-lg font-semibold flex items-center gap-2 mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  <Users className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} /> Online ({users.length})
                </h2>
                {users.map((user) => (
                  <div key={user} className={`flex items-center gap-3 p-3 rounded-xl mb-2 ${darkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>{user}</span>
                    {user === username && <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'}`}>You</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;