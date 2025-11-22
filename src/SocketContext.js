import { createContext } from 'react';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

export const SocketContext = createContext();

const getClientId = () => {
    let id = localStorage.getItem('chat_client_id');
    if (!id) {
        id = uuidv4();
        localStorage.setItem('chat_client_id', id);
    }
    return id;
};

export const socket = io('http://localhost:3000', {
    auth: {
        clientId: getClientId()
    }
});
