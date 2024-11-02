import express from "express";
import { WebSocket } from 'ws';

const router = express.Router();

// Create a map to store the messages
const messageMap = new Map();

let wss;

// Function to set the WebSocket server
export function setWebSocketServer(server) {
    wss = server;
}

router.get("/", (request, response) => {
    response.send({
        message: "Node.js and Express REST API",
    });
});

router.post('/message', async (request, response) => {
    var messageId = Date.now();
    
    messageMap.set(messageId, request.body.message);
    console.log('Message added to server:', messageMap);

    // Broadcast the new message to WebSocket clients
    const broadcastPromises = Array.from(wss.clients).map(client => {
        return new Promise((resolve, reject) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ id: messageId, message: request.body.message }), (error) => {
                    if (error) {
                        console.error("Error sending message to client:", error);
                        reject(error);
                    } else {
                        console.log(`Broadcasted message "${request.body.message}" to client`);
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    });    
    await Promise.all(broadcastPromises);        
    response.status(201).send(`Message added with ID: ${messageId}`);
});

router.get("/messages", (request, response) => {
    response.json(Array.from(messageMap.entries()));
});

export { router, messageMap }