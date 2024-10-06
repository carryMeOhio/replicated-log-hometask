import bodyParser from "body-parser";
import express from "express";
import { WebSocketServer } from 'ws';
import { router, messageMap, setWebSocketServer } from './routes/routes.js'

const port = 3002;
const app = express();

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// Use the routes from routes.js
app.use('/', router);

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

// Set the WebSocket server in the routes module
setWebSocketServer(wss);

// WebSocket connection event
wss.on('connection', (ws) => {
    console.log('Client connected');
  
    // Send existing messages to the client when they connect
    ws.send(JSON.stringify(Array.from(messageMap.entries())));
  
    // Handle client disconnection
    ws.on('close', () => {
      console.log('Client disconnected');
    });
});

// Start the server 
const server = app.listen(port, (error) => {
  if (error) return console.log(`Error: ${error}`);
  console.log(`Server listening on port ${server.address().port}`);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
});