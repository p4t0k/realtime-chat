/* eslint-env node */
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import config from './config.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: config.MAX_HTTP_BUFFER_SIZE,
    cors: {
        origin: config.CORS_ORIGIN,
        methods: ["GET", "POST"]
    }
});

// Data Stores
// Data Stores
const rooms = {}; // { roomId: { id, name, users: [socketId] } }
const users = {}; // { socketId: { id, nickname, roomId, x, y, clientId } }
const userIdentityStore = new Map(); // { clientId: { nickname, lastSeen } }
const usedNicknames = new Set();

// Cleanup old identities every hour
setInterval(() => {
    const now = Date.now();
    for (const [clientId, identity] of userIdentityStore.entries()) {
        if (now - identity.lastSeen > config.IDENTITY_TTL) {
            userIdentityStore.delete(clientId);
            // We could also free the nickname from usedNicknames if we tracked it better,
            // but usedNicknames is currently global and simple. 
            // Ideally, we should check if any active user has this nickname before freeing it.
            // For now, let's just clean the identity store to save memory.
        }
    }
}, 60 * 60 * 1000); // Run every hour

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    const clientId = socket.handshake.auth.clientId;
    let nickname;

    if (clientId && userIdentityStore.has(clientId)) {
        // Restore identity
        const identity = userIdentityStore.get(clientId);
        nickname = identity.nickname;
        // Update last seen
        userIdentityStore.set(clientId, { ...identity, lastSeen: Date.now() });
        console.log(`Restored identity for ${clientId}: ${nickname}`);


        // Check if there is an existing (disconnected but grace period active) user with this clientId
        // We need to find the OLD socket ID that maps to this clientId
        const oldSocketId = Object.keys(users).find(id => users[id].clientId === clientId);

        if (oldSocketId) {
            const oldUser = users[oldSocketId];
            if (oldUser.disconnectTimeout) {
                console.log(`Restoring session for ${nickname} (was ${oldSocketId}, now ${socket.id})`);
                clearTimeout(oldUser.disconnectTimeout);

                // Transfer state
                users[socket.id] = {
                    ...oldUser,
                    id: socket.id,
                    disconnectTimeout: null
                };

                // Remove old user record
                delete users[oldSocketId];

                // Update room if in one
                if (users[socket.id].roomId) {
                    const roomId = users[socket.id].roomId;
                    const room = rooms[roomId];
                    if (room) {
                        // Replace old socket ID with new one in room.users
                        room.users = room.users.map(id => id === oldSocketId ? socket.id : id);
                        socket.join(roomId);

                        // Notify room of update (optional, but good for consistency)
                        // Actually, since we just swapped IDs, other clients might not know the new ID yet for direct messages or typing?
                        // But we use user.id for everything. So we should probably tell them "user_updated" with new ID?
                        // Or just "user_joined" again? 
                        // If we send "user_joined", it might duplicate tiles if client doesn't handle it.
                        // Our client appends to list. 
                        // Let's send 'session_restored' to the user, and maybe 'user_updated' to others?
                        // The issue is other clients have the OLD socket ID in their list.
                        // We need to tell them: "User X is now Socket Y".
                        // Easiest way: "user_left" (old) then "user_joined" (new)? 
                        // That would cause a flicker.
                        // Better: "user_updated" with new ID? But ID is the key.
                        // Let's try sending "user_left" for old ID and "user_joined" for new ID for now, 
                        // but maybe suppress the "left" notification if we can?
                        // Actually, if we just join the room, the user is there.
                        // But other clients still think the user is 'oldSocketId'.

                        // Let's emit a special event or just standard join/leave to be safe.
                        // Flicker is better than broken state.
                        socket.to(roomId).emit('user_left', oldSocketId);
                        socket.to(roomId).emit('user_joined', users[socket.id]);
                    }
                }
            } else {
                // Old session exists but maybe active? (Duplicate tab case handled elsewhere)
                // Or maybe just lingering?
                users[socket.id] = {
                    id: socket.id,
                    nickname: nickname,
                    roomId: null,
                    clientId: clientId,
                    lines: [] // Store chat history
                };
            }
        } else {
            users[socket.id] = {
                id: socket.id,
                nickname: nickname,
                roomId: null,
                clientId: clientId,
                lines: [] // Store chat history
            };
        }
    } else {
        // Generate initial anonymous nickname
        nickname = `anon${Math.floor(Math.random() * 1000000)}`;
        while (usedNicknames.has(nickname)) {
            nickname = `anon${Math.floor(Math.random() * 1000000)}`;
        }
        usedNicknames.add(nickname);

        if (clientId) {
            userIdentityStore.set(clientId, { nickname, lastSeen: Date.now() });
        }

        users[socket.id] = {
            id: socket.id,
            nickname: nickname,
            roomId: null,
            clientId: clientId,
            lines: [] // Store chat history
        };
    }

    socket.emit('welcome', users[socket.id]);
    socket.emit('room_list', Object.values(rooms).map(r => ({
        id: r.id,
        name: r.name,
        userCount: r.users.length,
        createdAt: r.createdAt
    })));

    // Rate Limiting
    const rateLimits = {}; // { socketId: { count, lastAttempt, blockedUntil, currentChallenge: { answer, id } } }

    function validateInput(input, type) {
        if (!input || typeof input !== 'string') return { valid: false, error: 'Invalid input' };

        switch (type) {
            case 'nickname':
                if (input.length > config.MAX_NICKNAME_LENGTH) return { valid: false, error: `Nickname too long (max ${config.MAX_NICKNAME_LENGTH})` };
                if (!config.NICKNAME_REGEX.test(input)) return { valid: false, error: 'Nickname contains invalid characters' };
                break;
            case 'roomName':
                if (input.length > config.MAX_ROOM_NAME_LENGTH) return { valid: false, error: `Room name too long (max ${config.MAX_ROOM_NAME_LENGTH})` };
                break;
            case 'message':
                if (input.length > config.MAX_MESSAGE_LENGTH) return { valid: false, error: `Message too long (max ${config.MAX_MESSAGE_LENGTH})` };
                break;
        }
        return { valid: true };
    }

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
        if (now - limit.lastAttempt > config.RATE_LIMIT_WINDOW) {
            limit.count = 0;
            limit.lastAttempt = now;
        }

        limit.count++;
        limit.lastAttempt = now;

        if (limit.count > config.RATE_LIMIT_MAX) {
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
        // Rate limit nickname changes
        const check = checkRateLimit(socket.id);
        if (!check.allowed) {
            return callback({ success: false, error: check.error, challenge: check.challenge });
        }

        const validation = validateInput(newNickname, 'nickname');
        if (!validation.valid) {
            return callback({ success: false, error: validation.error });
        }

        if (usedNicknames.has(newNickname)) {
            callback({ success: false, error: 'Nickname already taken' });
        } else {
            const oldNickname = users[socket.id].nickname;
            usedNicknames.delete(oldNickname);
            usedNicknames.add(newNickname);
            users[socket.id].nickname = newNickname;

            // Update persistent identity
            if (users[socket.id].clientId) {
                userIdentityStore.set(users[socket.id].clientId, { nickname: newNickname, lastSeen: Date.now() });
            }

            callback({ success: true, nickname: newNickname });

            // Emit to self to update client state
            socket.emit('user_updated', users[socket.id]);

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

        const validation = validateInput(roomName, 'roomName');
        if (!validation.valid) {
            return callback({ success: false, error: validation.error });
        }

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

        // Check if this client is already in the room via another socket
        const clientId = users[socket.id].clientId;
        if (clientId) {
            const isAlreadyInRoom = room.users.some(socketId => {
                const user = users[socketId];
                return user && user.clientId === clientId && socketId !== socket.id;
            });

            if (isAlreadyInRoom) {
                return callback({ success: false, error: 'You are already in this room from another tab or window.' });
            }
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
            // Rate limit chat messages (newline)
            if (data.type === 'newline') {
                const check = checkRateLimit(socket.id);
                if (!check.allowed) {
                    // Silently drop or maybe emit error? 
                    // For chat, silent drop is often better to avoid spamming the user with errors too.
                    // But let's emit an error so client knows why.
                    // Since type_update doesn't have a callback in our client code, we might need to emit 'error' event.
                    // For now, just return to stop processing.
                    return;
                }

                const validation = validateInput(data.lineContent, 'message');
                if (!validation.valid) {
                    return; // Drop invalid messages
                }

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

        // Grace period for reconnection
        const user = users[socket.id];
        if (user && user.clientId) {
            console.log(`Scheduling disconnect for ${user.nickname} (${user.clientId})`);
            user.disconnectTimeout = setTimeout(() => {
                console.log(`Grace period expired for ${user.nickname}`);
                leaveRoom(socket);
                if (users[socket.id]) {
                    usedNicknames.delete(users[socket.id].nickname);
                    delete users[socket.id];
                }
                // Also clear from identity store if we want strict cleanup? 
                // No, keep identity for longer term persistence (e.g. refreshing page)
            }, 15000); // 15 seconds grace period
        } else {
            leaveRoom(socket);
            if (users[socket.id]) {
                usedNicknames.delete(users[socket.id].nickname);
                delete users[socket.id];
            }
        }
    });
});

function leaveRoom(socket) {
    const user = users[socket.id];
    if (!user || !user.roomId) return;

    // Clear any pending disconnect timeout if we are leaving explicitly
    if (user.disconnectTimeout) {
        clearTimeout(user.disconnectTimeout);
        user.disconnectTimeout = null;
    }

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

// eslint-disable-next-line no-undef
server.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
});
