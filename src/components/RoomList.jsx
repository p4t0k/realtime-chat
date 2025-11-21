import React, { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../App';
import ThemeSettings from './ThemeSettings';
import InfoMenu from './InfoMenu';
import CaptchaModal from './CaptchaModal';
import RoomTileBackground from './RoomTileBackground';

function RoomList({ currentUser, onJoin }) {
    const socket = useContext(SocketContext);
    const [rooms, setRooms] = useState([]);
    const [newRoomName, setNewRoomName] = useState('');
    const [nickname, setNickname] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (currentUser) {
            setNickname(currentUser.nickname);
        }
    }, [currentUser]);

    useEffect(() => {
        function onRoomList(list) {
            setRooms(list);
        }

        socket.on('room_list', onRoomList);

        // Request initial list
        // socket.emit('get_rooms'); // Server sends it on connect, but maybe we need to ask if we come back

        return () => {
            socket.off('room_list', onRoomList);
        };
    }, [socket]);

    const [captchaChallenge, setCaptchaChallenge] = useState(null);
    const [pendingAction, setPendingAction] = useState(null); // { type: 'create'|'join', args: [] }

    const handleCreateRoom = (e, captchaAnswer = null) => {
        if (e) e.preventDefault();
        if (!newRoomName.trim()) return;

        const args = captchaAnswer ? [newRoomName, captchaAnswer] : [newRoomName];

        socket.emit('create_room', ...args, (response) => {
            if (response.success) {
                setCaptchaChallenge(null);
                setPendingAction(null);
                // Auto join created room (no captcha needed for this internal join usually, but server might check? 
                // Actually server checks join_room separately. 
                // But usually creator joins immediately. 
                // Let's assume join_room might also trigger captcha if rate limit hits.
                joinRoom(response.roomId);
            } else if (response.error === 'captcha_required') {
                setCaptchaChallenge(response.challenge);
                setPendingAction({ type: 'create', args: [newRoomName] });
            } else {
                setError(response.error);
            }
        });
    };

    const joinRoom = (roomId, captchaAnswer = null) => {
        const args = captchaAnswer ? [roomId, captchaAnswer] : [roomId];

        socket.emit('join_room', ...args, (response) => {
            if (response.success) {
                setCaptchaChallenge(null);
                setPendingAction(null);
                onJoin(response.room, response.users);
            } else if (response.error === 'captcha_required') {
                setCaptchaChallenge(response.challenge);
                setPendingAction({ type: 'join', args: [roomId] });
            } else {
                setError(response.error);
            }
        });
    };

    const handleCaptchaVerify = (answer) => {
        if (pendingAction) {
            if (pendingAction.type === 'create') {
                handleCreateRoom(null, answer);
            } else if (pendingAction.type === 'join') {
                joinRoom(pendingAction.args[0], answer);
            }
        }
    };



    const handleNicknameChange = (e) => {
        setNickname(e.target.value);
    };

    const saveNickname = () => {
        if (nickname.length < 4) return; // Don't save if too short
        if (nickname !== currentUser.nickname) {
            socket.emit('set_nickname', nickname, (response) => {
                if (response.success) {
                    // Update local state if needed, but App.jsx listens to user updates? 
                    // Actually App.jsx listens to 'welcome' only. We might need to update currentUser in App.
                    // But for now let's just rely on the server response.
                    setError('');
                } else {
                    setError(response.error);
                    setNickname(currentUser.nickname); // Revert
                }
            });
        }
    };

    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
            // console.log('Tick'); // Optional debug
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

    const [searchQuery, setSearchQuery] = useState('');

    const filteredRooms = rooms.filter(room =>
        room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isNicknameValid = nickname.length >= 4;
    const isRoomNameValid = newRoomName.length === 0 || newRoomName.length >= 4;

    const [activeMenu, setActiveMenu] = useState(null); // 'info' | 'theme' | null

    const toggleMenu = (menu) => {
        setActiveMenu(prev => prev === menu ? null : menu);
    };

    return (
        <div className="room-list-container" style={{ position: 'relative' }}>
            {captchaChallenge && (
                <CaptchaModal
                    challenge={captchaChallenge}
                    onVerify={handleCaptchaVerify}
                    onCancel={() => {
                        setCaptchaChallenge(null);
                        setPendingAction(null);
                    }}
                />
            )}
            <InfoMenu
                isOpen={activeMenu === 'info'}
                onToggle={() => toggleMenu('info')}
            />
            <ThemeSettings
                isOpen={activeMenu === 'theme'}
                onToggle={() => toggleMenu('theme')}
            />
            <h1 className="neon-text">ASOCIAL CHAT</h1>

            <div className="user-controls">
                <input
                    type="text"
                    value={nickname}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (/^[a-zA-Z0-9_\-]*$/.test(val)) {
                            handleNicknameChange(e);
                        }
                    }}
                    onBlur={saveNickname}
                    placeholder="Your Nickname (min 4 chars)"
                    maxLength={25}
                    className={`input-highlight ${!isNicknameValid && nickname.length > 0 ? 'input-error' : ''}`}
                />
            </div>

            <div className="controls-row" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', width: '80%', maxWidth: '800px' }}>
                <form onSubmit={(e) => {
                    if (newRoomName.length < 4) {
                        e.preventDefault();
                        return;
                    }
                    handleCreateRoom(e);
                }} className="create-room-form" style={{ flex: 1, display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (/^[a-zA-Z0-9_\-@]*$/.test(val)) {
                                setNewRoomName(val);
                            }
                        }}
                        placeholder="New Room Name (min 4 chars)"
                        maxLength={24}
                        style={{ flex: 1 }}
                        className={!isRoomNameValid ? 'input-error' : ''}
                    />
                    <button type="submit" disabled={!isRoomNameValid || newRoomName.length === 0} style={{ opacity: (!isRoomNameValid || newRoomName.length === 0) ? 0.5 : 1 }}>Create</button>
                </form>

                <div className="search-room" style={{ flex: 1 }}>
                    <input
                        type="text"
                        placeholder="Search Rooms..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            {error && <div className="error-message" style={{ color: 'red' }}>{error}</div>}

            <div className="rooms-grid">
                {filteredRooms.map(room => (
                    <div key={room.id} className="room-card" style={{ position: 'relative', overflow: 'hidden' }}>
                        <RoomTileBackground seed={room.id} />
                        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <h3>{room.name}</h3>
                                <span style={{ fontSize: '0.7rem', color: '#666', fontFamily: 'monospace' }}>
                                    {formatTime(room.createdAt)}
                                </span>
                            </div>
                            <p>{room.userCount}/10 users</p>
                            <button
                                onClick={() => joinRoom(room.id)}
                                disabled={room.userCount >= 10}
                                style={{
                                    marginTop: 'auto',
                                    opacity: room.userCount >= 10 ? 0.5 : 1,
                                    cursor: room.userCount >= 10 ? 'not-allowed' : 'pointer',
                                    width: '100%'
                                }}
                            >
                                {room.userCount >= 10 ? 'Full' : 'Join'}
                            </button>
                        </div>
                    </div>
                ))}
                {filteredRooms.length === 0 && rooms.length > 0 && <p style={{ gridColumn: '1 / -1', textAlign: 'center', width: '100%' }}>No rooms match your search.</p>}
                {rooms.length === 0 && <p style={{ gridColumn: '1 / -1', textAlign: 'center', width: '100%' }}>No active rooms. Create one!</p>}
            </div>
        </div>
    );
}

export default RoomList;
