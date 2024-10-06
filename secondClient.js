import express from "express";
import { WebSocket } from 'ws';

const port = 3005;
// Create a new Express app
const app = express();

// Create a map to store the replicated messages
const clientMessageMap = new Map();

// Connect to the WebSocket server on the main server
const ws = new WebSocket('ws://server:3002');

// Listen for WebSocket messages and update the client's message map
ws.on('message', (data) => {
  const messageData = JSON.parse(data);

  // If data is an array, it's the full message map; otherwise, it's a new message
  if (Array.isArray(messageData)) {
    // Sync the client's map with the server's
    messageData.forEach(([id, message]) => {
      clientMessageMap.set(id, message);
    });
  } else {
    // Add the new message to the client's map
    clientMessageMap.set(messageData.id, messageData.message);
  }

  console.log('Client message map updated:', clientMessageMap);
});

// get the replicated messages
app.get('/replicated-messages', (req, res) => {
  res.json(Array.from(clientMessageMap.entries()));
});

// Start the client
app.listen(port, () => {
  console.log(`Client is listening on port ${port}`);
});