# 🔄 Real-Time Chat Application with Socket.io

## 🎯 Project Overview
A modern, full-featured **real-time chat application** built with **React**, **Socket.io**, and **Node.js**.  
It includes multiple chat rooms, user authentication, message persistence, and a beautiful responsive interface with **dark/light theme** support.

---

## 🏗️ System Architecture

### 🔌 Real-Time Communication
- **Socket.io** for bidirectional client-server communication  
- Instant messaging with real-time message delivery  
- Live user presence showing online/offline status  
- Typing indicators when users are composing messages  
- Room-based messaging with separate chat spaces  

### 🗄️ Data Management
- **SQLite** database for message persistence and user accounts  
- In-memory storage for active user sessions  
- Message history with read receipts and reactions  
- Room-based data segregation for organized conversations  

### 🎨 User Experience
- Fully **responsive design** that works on desktop, tablet, and mobile  
- **Dark/Light theme** with system preference detection  
- Real-time notifications for user joins/leaves  
- Message reactions with emoji support  
- File upload capability  

---

## 🚀 Quick Start Guide

### 🧩 Prerequisites
- Node.js (v18 or higher)  
- npm or yarn package manager  

### ⚙️ Installation & Local Development

#### Clone and Setup the Project
```bash
git clone <your-repository-url>
cd socketio-chat

cd server
npm install

# Setup client
cd ../client
npm install
