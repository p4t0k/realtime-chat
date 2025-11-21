import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// Data Stores
const rooms = {}; // { roomId: { id, name, users: [socketId] } }
const users = {}; // { socketId: { id, nickname, roomId, x, y } }
const usedNicknames = new Set();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Generate initial anonymous nickname
    let nickname = `anon${Math.floor(Math.random() * 1000000)}`;
    while (usedNicknames.has(nickname)) {
        nickname = `anon${Math.floor(Math.random() * 1000000)}`;
    }
    usedNicknames.add(nickname);

    users[socket.id] = {
        id: socket.id,
        nickname: nickname,
        roomId: null,
        lines: [] // Store chat history
    };

    socket.emit('welcome', users[socket.id]);
    socket.emit('room_list', Object.values(rooms).map(r => ({
        id: r.id,
        name: r.name,
        userCount: r.users.length,
        createdAt: r.createdAt
    })));

    // Rate Limiting
    const rateLimits = {}; // { socketId: { count, lastAttempt, blockedUntil, currentChallenge: { answer, id } } }
    const RATE_LIMIT_WINDOW = 10000; // 10 seconds
    const RATE_LIMIT_MAX = 3; // Max 3 actions per window

    function checkRateLimit(socketId, captchaAnswer) {
        const now = Date.now();
        if (!rateLimits[socketId]) {
            rateLimits[socketId] = { count: 0, lastAttempt: now, blockedUntil: 0 };
        }

        const limit = rateLimits[socketId];

        // Check if blocked
        if (limit.blockedUntil > now) {
            // If they provided a CAPTCHA answer, verify it
            if (captchaAnswer && limit.currentChallenge) {
                if (parseInt(captchaAnswer) === limit.currentChallenge.answer) {
                    // Correct! Reset limits
                    limit.blockedUntil = 0;
                    limit.count = 0;
                    limit.currentChallenge = null;
                    return { allowed: true };
                } else {
                    return { allowed: false, error: 'Incorrect CAPTCHA answer' };
                }
            }
            return { allowed: false, error: 'captcha_required', challenge: limit.currentChallenge };
        }

        // Reset window if expired
        if (now - limit.lastAttempt > RATE_LIMIT_WINDOW) {
            limit.count = 0;
            limit.lastAttempt = now;
        }

        limit.count++;
        limit.lastAttempt = now;

        if (limit.count > RATE_LIMIT_MAX) {
            // Block them and generate challenge
            limit.blockedUntil = now + 60000; // Block for 1 minute (or until solved)
            const num1 = Math.floor(Math.random() * 10) + 1;
            const num2 = Math.floor(Math.random() * 10) + 1;
            limit.currentChallenge = {
                question: `${num1} + ${num2} = ?`,
                answer: num1 + num2,
                id: uuidv4()
            };
            return { allowed: false, error: 'captcha_required', challenge: { question: limit.currentChallenge.question, id: limit.currentChallenge.id } };
        }

        return { allowed: true };
    }

    socket.on('set_nickname', (newNickname, callback) => {
        if (usedNicknames.has(newNickname)) {
            callback({ success: false, error: 'Nickname already taken' });
        } else {
            usedNicknames.delete(users[socket.id].nickname);
            usedNicknames.add(newNickname);
            users[socket.id].nickname = newNickname;
            callback({ success: true, nickname: newNickname });

            // Notify room if user is in one
            const roomId = users[socket.id].roomId;
            if (roomId) {
                io.to(roomId).emit('user_updated', users[socket.id]);
            }
        }
    });

    socket.on('create_room', (roomName, captchaAnswer, callback) => {
        // Handle callback being the second argument if captchaAnswer is omitted (legacy/normal call)
        if (typeof captchaAnswer === 'function') {
            callback = captchaAnswer;
            captchaAnswer = null;
        }

        const check = checkRateLimit(socket.id, captchaAnswer);
        if (!check.allowed) {
            return callback({ success: false, error: check.error, challenge: check.challenge });
        }

        if (!roomName) return callback({ success: false, error: 'Room name required' });

        // Check for duplicate name
        const isDuplicate = Object.values(rooms).some(r => r.name === roomName);
        if (isDuplicate) {
            return callback({ success: false, error: 'Room name already exists' });
        }

        const existingRoomId = users[socket.id].createdRoomId;
        if (existingRoomId) {
            const existingRoom = rooms[existingRoomId];
            // If room exists and is empty, user should delete it first (or we could auto-delete, but user asked for manual close)
            // User said: "if there are users he should be able to create another one"
            if (existingRoom && existingRoom.users.length === 0) {
                return callback({ success: false, error: 'You have an empty room. Please close it or join it.' });
            }
            // If room has users, we allow creating a new one (overwriting the tracked ID for now, or we could track multiple)
            // For simplicity, we just overwrite 'createdRoomId' so they can manage the NEW room.
        }

        const roomId = uuidv4();
        rooms[roomId] = {
            id: roomId,
            name: roomName,
            users: [],
            createdAt: Date.now()
        };
        users[socket.id].createdRoomId = roomId;

        io.emit('room_list', Object.values(rooms).map(r => ({
            id: r.id,
            name: r.name,
            userCount: r.users.length,
            createdAt: r.createdAt
        })));
        callback({ success: true, roomId });
    });

    socket.on('delete_room', (roomId, callback) => {
        const room = rooms[roomId];
        if (!room) return callback({ success: false, error: 'Room not found' });

        // Check ownership
        if (users[socket.id].createdRoomId !== roomId) {
            // Fallback: maybe they created it but then created another one? 
            // For now, strict check.
            return callback({ success: false, error: 'You are not the owner of this room' });
        }

        if (room.users.length > 0) {
            return callback({ success: false, error: 'Cannot delete room with users' });
        }

        delete rooms[roomId];
        users[socket.id].createdRoomId = null;
        io.emit('room_list', Object.values(rooms).map(r => ({
            id: r.id,
            name: r.name,
            userCount: r.users.length,
            createdAt: r.createdAt
        })));
        callback({ success: true });
    });

    socket.on('join_room', (roomId, captchaAnswer, callback) => {
        // Handle callback being the second argument
        if (typeof captchaAnswer === 'function') {
            callback = captchaAnswer;
            captchaAnswer = null;
        }

        const check = checkRateLimit(socket.id, captchaAnswer);
        if (!check.allowed) {
            return callback({ success: false, error: check.error, challenge: check.challenge });
        }

        const room = rooms[roomId];
        if (!room) return callback({ success: false, error: 'Room not found' });

        if (room.users.length >= 10) {
            return callback({ success: false, error: 'Room is full (max 10 users)' });
        }

        // Leave current room if any
        if (users[socket.id].roomId) {
            leaveRoom(socket);
        }

        socket.join(roomId);
        users[socket.id].roomId = roomId;
        users[socket.id].joinedAt = Date.now(); // Track join time
        room.users.push(socket.id);

        // Send room state to user
        const roomUsers = room.users.map(id => users[id]).filter(u => u);
        // Include createdAt in the room object sent back
        callback({ success: true, room: { id: room.id, name: room.name, createdAt: room.createdAt }, users: roomUsers });

        // Notify others
        socket.to(roomId).emit('user_joined', users[socket.id]);
        io.emit('room_list', Object.values(rooms).map(r => ({
            id: r.id,
            name: r.name,
            userCount: r.users.length,
            createdAt: r.createdAt
        })));
    });

    socket.on('leave_room', () => {
        leaveRoom(socket);
    });

    socket.on('type_update', (data) => {
        const roomId = users[socket.id].roomId;
        if (roomId) {
            // Update server-side history
            if (data.type === 'newline') {
                const user = users[socket.id];
                if (!user.lines) user.lines = [];
                user.lines.push({
                    id: Date.now() + Math.random(),
                    content: data.lineContent,
                    timestamp: Date.now()
                });
                if (user.lines.length > 6) { // Keep last 6 lines
                    user.lines.shift();
                }
            }

            // data contains { text, ... }
            socket.to(roomId).emit('user_typing', { userId: socket.id, ...data });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        leaveRoom(socket);
        if (users[socket.id]) {
            usedNicknames.delete(users[socket.id].nickname);
            delete users[socket.id];
        }
    });
});

function leaveRoom(socket) {
    const user = users[socket.id];
    if (!user || !user.roomId) return;

    const roomId = user.roomId;
    const room = rooms[roomId];

    if (room) {
        room.users = room.users.filter(id => id !== socket.id);
        socket.leave(roomId);
        user.roomId = null;
        user.lines = []; // Clear chat history

        socket.to(roomId).emit('user_left', socket.id);

        // Auto-delete room if empty
        if (room.users.length === 0) {
            delete rooms[roomId];
            // Lazy cleanup of createdRoomId: we don't strictly need to find the user and clear it now.
            // We handle it in create_room by checking if the room still exists.
        }

        io.emit('room_list', Object.values(rooms).map(r => ({
            id: r.id,
            name: r.name,
            userCount: r.users.length,
            createdAt: r.createdAt
        })));
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
