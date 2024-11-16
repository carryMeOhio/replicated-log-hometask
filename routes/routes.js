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
    const writeConcern = request.body.writeConcern || 1; // Default value = 1
    
    messageMap.set(messageId, request.body.message);
    console.log('Message added to server:', messageMap);

    // store unique ACKs
    const acknowledgments = new Set();
    // calculate required number of ACKs
    const requiredAcks = Math.min(writeConcern, 1 + wss.clients.size); // Master + # of clients
    console.log('required number of ACKs: ' + requiredAcks);

    // Master acknowledgment
    acknowledgments.add('master');
    console.log(`Master acknowledged message with ID: ${messageId}`);

    // Helper function to send messages to clients
    const sendToClient = (client, clientIndex) =>
        new Promise((resolve, reject) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ id: messageId, message: request.body.message }), (error) => {
                    if (error) {
                        console.error(`Error sending message to client ${clientIndex}:`, error);
                        resolve(); // Resolve even on error to avoid blocking
                        return;
                    }

                    console.log(`Message "${request.body.message}" sent to client ${clientIndex}`);

                    // Listen for acknowledgment
                    const ackListener = (ackData) => {
                        try {
                            const ack = JSON.parse(ackData);
                            const uniqueAckKey = `client-${clientIndex}`;

                            if (ack.status === 'ACK' && ack.id === messageId) {
                                if (!acknowledgments.has(uniqueAckKey)) {
                                    acknowledgments.add(uniqueAckKey);
                                    console.log(`ACK received from client ${clientIndex} for message ID: ${ack.id}`);
                                }
                                resolve(); // Resolve when the ACK is received
                            }
                        } catch (err) {
                            console.error(`Error parsing ACK from client ${clientIndex}:`, err);
                            resolve(); // Resolve on parsing error
                        } finally {
                            client.off('message', ackListener); // Clean up listener
                        }
                    };
                    client.on('message', ackListener);
                });
            } else {
                resolve(); // Resolve if the client is not open
            }
        });

    // Broadcast to all clients
    const broadcastPromises = Array.from(wss.clients).map(sendToClient);

    // Wait for required acknowledgments
    try {
        await new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                if (acknowledgments.size >= requiredAcks) {
                    clearInterval(interval);
                    resolve(); // All required ACKs received
                }
            }, 100);

            // Timeout to avoid infinite wait and heap error
            setTimeout(() => {
                clearInterval(interval);
                reject(new Error(`Timeout waiting for ${requiredAcks} acknowledgments`));
            }, 20000);
        });

        response.status(201).send(`Message added with ID: ${messageId} and acknowledged by ${requiredAcks} nodes`);
        console.log(`MASTER POST REQUEST COMPLETED`);
    } catch (error) {
        console.error("Error waiting for acknowledgments:", error);
        response.status(500).send(`Error processing message: ${error.message}`);
    }
});

router.get("/messages", (request, response) => {
    response.json(Array.from(messageMap.entries()));
});

export { router, messageMap }