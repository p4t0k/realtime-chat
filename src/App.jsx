import React, { useState, useEffect } from 'react';
import { SocketContext, socket } from './SocketContext';
import RoomList from './components/RoomList';
import ChatRoom from './components/ChatRoom';
import ErrorBoundary from './components/ErrorBoundary';
import { APP_VERSION } from './constants';

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
      // Don't clear currentRoom here to allow for reconnection
    }

    function onWelcome(user) {
      setCurrentUser(user);
    }

    function onUserUpdated(user) {
      if (user.id === socket.id) {
        setCurrentUser(user);
      }
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('welcome', onWelcome);
    socket.on('user_updated', onUserUpdated);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('welcome', onWelcome);
      socket.off('user_updated', onUserUpdated);
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
        <div className="app-version">v{APP_VERSION}</div>
      </div>
    </SocketContext.Provider>
  );
}

export default App;
