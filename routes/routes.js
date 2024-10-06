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

router.post('/message', (request, response) => {
    var messageId = Date.now();
    messageMap.set(messageId, request.body.message);
    console.log('Message added to server:', messageMap);

    // Broadcast the new message to WebSocket clients
    const messageData = { id: messageId, message: request.body.message };
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(messageData));
            console.log("Message " + messageData.id + " added for client ");
        }
    });

    response.status(201).send(`Message added with ID: ${messageId}`);
});

router.get("/messages", (request, response) => {
    response.json(Array.from(messageMap.entries()));
});

export { router, messageMap }