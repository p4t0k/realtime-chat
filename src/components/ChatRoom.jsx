import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { SocketContext } from '../SocketContext';
import UserTile from './UserTile';
import ConnectionLines from './ConnectionLines';
import ThemeSettings from './ThemeSettings';

function ChatRoom({ room, currentUser, onLeave }) {

    const socket = useContext(SocketContext);
    const [users, setUsers] = useState(room.users || []);
    const [pendingTag, setPendingTag] = useState(null);
    const [activityLog, setActivityLog] = useState([]);
    const usersRef = useRef(users);

    useEffect(() => {
        usersRef.current = users;
    }, [users]);

    const addLogEntry = (message) => {
        const now = new Date();
        const timestamp = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0') + ':' +
            String(now.getSeconds()).padStart(2, '0');

        setActivityLog(prev => {
            const newLog = [...prev, `${timestamp}: ${message}`];
            return newLog.slice(-5); // Keep last 5 entries
        });
    };

    const [positions, setPositions] = useState(() => {
        const initialPositions = {};
        (room.users || []).forEach(user => {
            initialPositions[user.id] = {
                x: Math.random() * (window.innerWidth - 300),
                y: Math.random() * (window.innerHeight - 200),
                vx: 0,
                vy: 0
            };
        });
        return initialPositions;
    }); // { userId: { x, y, vx, vy } }
    const [activeTags, setActiveTags] = useState({}); // { userId: [taggedNicknames] }
    const requestRef = useRef();

    useEffect(() => {
        function onUserJoined(user) {
            setUsers(prev => [...prev, user]);
            addLogEntry(`User ${user.nickname} joined the room`);
            setPositions(prev => ({
                ...prev,
                [user.id]: {
                    x: Math.random() * (window.innerWidth - 300),
                    y: Math.random() * (window.innerHeight - 200),
                    vx: 0,
                    vy: 0
                }
            }));
        }

        function onUserLeft(userId) {
            const user = usersRef.current.find(u => u.id === userId);
            if (user) {
                addLogEntry(`User ${user.nickname} left the room`);
            }
            setUsers(prev => prev.filter(u => u.id !== userId));
            setPositions(prev => {
                const newPos = { ...prev };
                delete newPos[userId];
                return newPos;
            });
            setActiveTags(prev => {
                const newTags = { ...prev };
                delete newTags[userId];
                return newTags;
            });
        }

        function onUserUpdated(updatedUser) {
            const oldUser = usersRef.current.find(u => u.id === updatedUser.id);
            if (oldUser && oldUser.nickname !== updatedUser.nickname) {
                addLogEntry(`User ${oldUser.nickname} changed to ${updatedUser.nickname}`);
            }
            setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        }

        socket.on('user_joined', onUserJoined);
        socket.on('user_left', onUserLeft);
        socket.on('user_updated', onUserUpdated);

        return () => {
            socket.off('user_joined', onUserJoined);
            socket.off('user_left', onUserLeft);
            socket.off('user_updated', onUserUpdated);
        };
    }, [socket]);

    const handleTagsChange = useCallback((userId, tags) => {
        setActiveTags(prev => {
            // Optimization: only update if changed
            const prevTags = prev[userId] || [];
            if (prevTags.length === tags.length && prevTags.every((t, i) => t === tags[i])) {
                return prev;
            }
            return {
                ...prev,
                [userId]: tags
            };
        });
    }, []);

    const handleTileClick = useCallback((clickedUser) => {
        if (clickedUser.id !== currentUser?.id) {
            setPendingTag(clickedUser.nickname);
        }
    }, [currentUser]);

    const handleTagConsumed = useCallback(() => {
        setPendingTag(null);
    }, []);

    // Physics Loop
    useEffect(() => {
        const animate = () => {
            setPositions(prevPositions => {
                const newPositions = { ...prevPositions };
                const userIds = Object.keys(newPositions);

                // Apply forces
                userIds.forEach(id => {
                    let { x, y, vx, vy } = newPositions[id];

                    // 1. Center Gravity (weak)
                    const centerX = window.innerWidth / 2 - (window.innerWidth < 600 ? 80 : 150);
                    const centerY = window.innerHeight / 2 - (window.innerWidth < 600 ? 65 : 100);
                    vx += (centerX - x) * 0.00002; // Reduced to very slow drift
                    vy += (centerY - y) * 0.00002;

                    // 2. Attraction (Tags)
                    const tags = activeTags[id] || [];
                    tags.forEach(targetNickname => {
                        const targetUser = users.find(u => u.nickname === targetNickname);
                        if (targetUser && newPositions[targetUser.id]) {
                            const target = newPositions[targetUser.id];
                            const dx = target.x - x;
                            const dy = target.y - y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > 0) {
                                // Pull towards target
                                const force = 0.0002; // Very gentle pull
                                vx += dx * force;
                                vy += dy * force;
                            }
                        }
                    });

                    // 3. Repulsion (All users)
                    userIds.forEach(otherId => {
                        if (id === otherId) return;
                        const other = newPositions[otherId];
                        const dx = x - other.x;
                        const dy = y - other.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        // Responsive repulsion distance
                        // Tile width is 160px on mobile, 200px on desktop
                        // Padding/Gap should be added
                        const isMobile = window.innerWidth < 600;
                        const tileWidth = isMobile ? 160 : 200;
                        const tileHeight = isMobile ? 130 : 150;
                        const minDist = isMobile ? 180 : 350;

                        if (dist < minDist && dist > 0) {
                            const force = (minDist - dist) * 0.002; // Very gentle repulsion
                            vx += (dx / dist) * force;
                            vy += (dy / dist) * force;
                        }
                    });

                    // 4. Repulsion from Activity Log (Bottom-Left)
                    // Log area approx: width 250px, height 150px from bottom-left
                    const logWidth = 250;
                    const logHeight = 150;
                    if (x < logWidth && y > window.innerHeight - logHeight) {
                        // Push away from the corner
                        const distToEdgeX = x - logWidth;
                        const distToEdgeY = y - (window.innerHeight - logHeight);

                        // Simple force: push right and up
                        // But we want to push them out of the box via the closest edge?
                        // Or just generally repel from the corner (0, window.innerHeight)

                        // Let's push them towards the center if they are in the box
                        const force = 0.001;
                        vx += force * 2; // Push right
                        vy -= force * 2; // Push up
                    }



                    // Apply velocity
                    x += vx;
                    y += vy;

                    // Damping
                    vx *= 0.9;
                    vy *= 0.9;

                    // Boundaries
                    const isMobile = window.innerWidth < 600;
                    const tileWidth = isMobile ? 160 : 200;
                    const tileHeight = isMobile ? 130 : 150;

                    if (x < 0) { x = 0; vx *= -1; }
                    if (y < 80) { y = 80; vy *= -1; } // Top margin for UI strip
                    if (x > window.innerWidth - tileWidth) { x = window.innerWidth - tileWidth; vx *= -1; }
                    if (y > window.innerHeight - tileHeight) { y = window.innerHeight - tileHeight; vy *= -1; }

                    newPositions[id] = { x, y, vx, vy };
                });

                return newPositions;
            });

            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(requestRef.current);
    }, [users, activeTags]); // Re-bind when users change to get fresh user list references?
    // Actually users array is needed for nickname lookup.
    // But setPositions callback gets fresh positions.
    // We need to be careful about closure staleness for 'users' and 'activeTags'.
    // Since we use them inside the loop, we should include them in dependency array.
    // But that restarts the animation loop. That's fine.

    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (createdAt) => {
        if (!createdAt) return '00:00:00';
        const elapsed = Math.max(0, now - createdAt);
        const seconds = Math.floor((elapsed / 1000) % 60);
        const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
        const hours = Math.floor((elapsed / (1000 * 60 * 60)));

        const pad = (n) => n.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    const formatAbsoluteTime = (createdAt) => {
        if (!createdAt) return '';
        return new Date(createdAt).toLocaleTimeString();
    };

    return (
        <div className="chat-room">
            <ThemeSettings />
            <div className="room-header" style={{ position: 'absolute', top: 10, left: 10, zIndex: 100, display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button onClick={onLeave}>Leave</button>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="neon-text" style={{ fontSize: '1.2rem' }}>{room.name}</span>
                    <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
                        {users.length}/10 users • {formatAbsoluteTime(room.createdAt)} ({formatTime(room.createdAt)})
                    </span>
                </div>
            </div>

            <div style={{
                position: 'absolute',
                bottom: 10,
                left: 10,
                zIndex: 90,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'flex-start',
                pointerEvents: 'none',
                textAlign: 'left'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {activityLog.map((log, index) => (
                        <div key={index} style={{
                            fontSize: '0.5rem',
                            color: '#888',
                            opacity: 0.7,
                            whiteSpace: 'nowrap',
                            marginBottom: '2px',
                            textShadow: 'none'
                        }}>
                            {log}
                        </div>
                    ))}
                </div>
            </div>

            <ConnectionLines users={users} positions={positions} activeTags={activeTags} />

            <div className="tiles-container">
                {users.map(user => {
                    if (!user) return null;
                    const isMe = user.id === currentUser?.id;

                    return (
                        <UserTile
                            key={user.id}
                            user={user}
                            isMe={isMe}
                            position={positions[user.id] || { x: 0, y: 0 }}
                            onTagsChange={handleTagsChange}
                            onTileClick={handleTileClick}
                            pendingTag={user.id === currentUser?.id ? pendingTag : null}
                            onTagConsumed={handleTagConsumed}
                            allUsers={users}
                            now={now}
                            onLeave={onLeave}
                        />
                    )
                })}
            </div>
        </div>
    );
}

export default ChatRoom;
