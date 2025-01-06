import express from "express";
import { WebSocket } from 'ws';

const port = 3003;
// Create a new Express app
const app = express();

// Create a map to store the replicated messages
const clientMessageMap = new Map();
// Track processed message IDs for deduplication
const processedMessages = new Set();
// Buffer for out-of-order messages
const messageBuffer = new Map();
 // Track the next expected sequence 
let nextExpectedSequence = 1;
// Failure rate for simulating errors
const FAILURE_RATE = 0.3;
// Interval for messages retrying
const RETRY_INTERVAL = 5000;
let retryTimeout = null;
// Check whether message is retransmitted
const retransmissionStatus = new Set();


// Connect to the WebSocket server on the main server
const ws = new WebSocket('ws://server:3002');

// Function to process a message
const processMessage = (messageData, webS) => {
  console.log(`Processing message with ID: ${messageData.id}, sequence: ${messageData.sequence}`);

  // Add the message to the client's map using ID as the key
  clientMessageMap.set(messageData.id, messageData.message);

  // Mark the message as processed
  processedMessages.add(messageData.id);

  // Send ACK back to the server with the sequence number
  const ack = { status: 'ACK', id: messageData.id, sequence: messageData.sequence };
  webS.send(JSON.stringify(ack));
  console.log(`Acknowledgment sent for message ID: ${messageData.id}, sequence: ${messageData.sequence}`);

  // Clear retry timeout if this is the missing sequence
  if (messageData.sequence === nextExpectedSequence && retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
    console.log(`Retry cleared for sequence: ${nextExpectedSequence}`);
  }
};

// Function to process buffered messages
const processBufferedMessages = (webS) => {
  while (messageBuffer.has(nextExpectedSequence)) {
    const messageData = messageBuffer.get(nextExpectedSequence);
    messageBuffer.delete(nextExpectedSequence);
    processMessage(messageData, webS);
    nextExpectedSequence++;
  }

  // If all buffered messages are processed, clear the retry timeout
  if (!messageBuffer.size && retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
};

// Function to request retransmission of missing messages
const requestRetransmission = () => {
  if (retryTimeout) {
    console.warn(`Retry already scheduled for sequence: ${nextExpectedSequence}`);
    return;
  }

  console.warn(`Requesting retransmission for missing sequence: ${nextExpectedSequence}`);
  const retransmitRequest = { action: "RETRANSMIT", sequence: nextExpectedSequence };
  ws.send(JSON.stringify(retransmitRequest));
  retransmissionStatus.add(nextExpectedSequence);

  retryTimeout = setTimeout(() => {
    retryTimeout = null;
    if (!processedMessages.has(nextExpectedSequence)) {
      console.warn(`Still missing sequence: ${nextExpectedSequence}. Retrying.`);
      requestRetransmission();
    }
  }, RETRY_INTERVAL);
};

// WebSocket message handler
ws.on('message', (data) => {
  const messageData = JSON.parse(data);

  if (!messageData.id || !messageData.sequence || !messageData.message) {
    console.error(`Client: Received malformed or incomplete message`, messageData);
    return;
  }

  console.log(`Client: Received message`, messageData);

  // Simulate random failure only for initial (non-retransmitted) messages
  if (!retransmissionStatus.has(messageData.sequence) && Math.random() < FAILURE_RATE) {
    console.error(`Simulating internal error for message ID: ${messageData.id}, sequence: ${messageData.sequence}`);
    return;
  }

  // Check if the message has already been processed
  if (processedMessages.has(messageData.id)) {
    console.log(`Client: Duplicate message with ID ${messageData.id} ignored`);
    return;
  }

  // Process message or buffer it based on sequence
  if (messageData.sequence === nextExpectedSequence) {
    processMessage(messageData, ws);
    nextExpectedSequence++;
    processBufferedMessages(ws);
  } else if (messageData.sequence > nextExpectedSequence) {
    console.log(`Out-of-order message received. Buffering message with sequence: ${messageData.sequence}`);
    messageBuffer.set(messageData.sequence, messageData);
    requestRetransmission();
  } else {
    console.log(`Old message received and ignored. Sequence: ${messageData.sequence}`);
  }
});

// Get the replicated messages
app.get('/replicated-messages', (req, res) => {
  res.json(Array.from(clientMessageMap.entries()));
});

// Start the client
app.listen(port, () => {
  console.log(`Client 1 is listening on port ${port}`);
});