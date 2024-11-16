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
  // additional data validation
  let parsedData;
  try {
      parsedData = JSON.parse(data);
  } catch (error) {
      console.error(`Client 2: Error parsing incoming message`, error);
      return;
  }

  const messageData = JSON.parse(data);

  if (!messageData.id) {
    console.error(`Client 2: Received message with undefined ID`);
    return;
}

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

  // Simulate some delay in processing
  const delay = Math.random() * 10000 + 5000; // Random delay between 5000ms and 15000ms
  setTimeout(() => {
      console.log(`Client 2 stored message with ID: ${messageData.id}`);
      // Send ACK back to the server
      const ack = { status: 'ACK', id: messageData.id };
      ws.send(JSON.stringify(ack));
      console.log(`Acknowledgment sent from client 2 for message ID: ${messageData.id}`);
  }, delay);

  console.log('Client 2 message map updated:', clientMessageMap);
});

// get the replicated messages
app.get('/replicated-messages', (req, res) => {
  res.json(Array.from(clientMessageMap.entries()));
});

// Start the client
app.listen(port, () => {
  console.log(`Client 2 is listening on port ${port}`);
});