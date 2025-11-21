import React, { useState, useEffect, createContext } from 'react';
import { io } from 'socket.io-client';
import RoomList from './components/RoomList';
import ChatRoom from './components/ChatRoom';
import ErrorBoundary from './components/ErrorBoundary';

export const SocketContext = createContext();

const socket = io('http://localhost:3000');

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
      setCurrentRoom(null);
    }

    function onWelcome(user) {
      setCurrentUser(user);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('welcome', onWelcome);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('welcome', onWelcome);
    };
  }, []);

  const handleJoinRoom = (room, users) => {
    setCurrentRoom({ ...room, users });
  };

  const handleLeaveRoom = () => {
    socket.emit('leave_room');
    setCurrentRoom(null);
  };

  return (
    <SocketContext.Provider value={socket}>
      <div className="app-container">
        {!isConnected && <div className="connecting-overlay">Connecting...</div>}

        {currentRoom ? (
          <ErrorBoundary>
            <ChatRoom
              room={currentRoom}
              currentUser={currentUser}
              onLeave={handleLeaveRoom}
            />
          </ErrorBoundary>
        ) : (
          <RoomList
            currentUser={currentUser}
            onJoin={handleJoinRoom}
          />
        )}
      </div>
    </SocketContext.Provider>
  );
}

export default App;
