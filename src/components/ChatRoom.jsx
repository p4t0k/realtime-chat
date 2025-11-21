import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { SocketContext } from '../App';
import UserTile from './UserTile';
import ConnectionLines from './ConnectionLines';
import ThemeSettings from './ThemeSettings';

function ChatRoom({ room, currentUser, onLeave }) {
    console.log('ChatRoom rendering', { room, currentUser });
    const socket = useContext(SocketContext);
    const [users, setUsers] = useState(room.users || []);
    const [pendingTag, setPendingTag] = useState(null);
    console.log('ChatRoom users state:', users);
    const [positions, setPositions] = useState({}); // { userId: { x, y, vx, vy } }
    const [activeTags, setActiveTags] = useState({}); // { userId: [taggedNicknames] }
    const requestRef = useRef();

    useEffect(() => {
        // Initialize positions for existing users
        const initialPositions = {};
        (room.users || []).forEach(user => {
            initialPositions[user.id] = {
                x: Math.random() * (window.innerWidth - 300),
                y: Math.random() * (window.innerHeight - 200),
                vx: 0,
                vy: 0
            };
        });
        setPositions(initialPositions);
    }, []);

    useEffect(() => {
        function onUserJoined(user) {
            setUsers(prev => [...prev, user]);
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
                    const centerX = window.innerWidth / 2 - 150;
                    const centerY = window.innerHeight / 2 - 100;
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
                        const minDist = 350; // Tile width + padding

                        if (dist < minDist && dist > 0) {
                            const force = (minDist - dist) * 0.002; // Very gentle repulsion
                            vx += (dx / dist) * force;
                            vy += (dy / dist) * force;
                        }
                    });



                    // Apply velocity
                    x += vx;
                    y += vy;

                    // Damping
                    vx *= 0.9;
                    vy *= 0.9;

                    // Boundaries
                    if (x < 0) { x = 0; vx *= -1; }
                    if (y < 80) { y = 80; vy *= -1; } // Top margin for UI strip
                    if (x > window.innerWidth - 300) { x = window.innerWidth - 300; vx *= -1; }
                    if (y > window.innerHeight - 200) { y = window.innerHeight - 200; vy *= -1; }

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

    const [now, setNow] = useState(Date.now());

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

            <ConnectionLines users={users} positions={positions} activeTags={activeTags} />

            <div className="tiles-container">
                {users.map(user => {
                    if (!user) return null;
                    const isMe = user.id === currentUser?.id;
                    console.log(`Rendering tile for ${user.nickname}: user.id=${user.id}, currentUser.id=${currentUser?.id}, isMe=${isMe}`);
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
                        />
                    )
                })}
            </div>
        </div>
    );
}

export default ChatRoom;
