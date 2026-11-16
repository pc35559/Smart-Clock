import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Initialize the Express application instance.
const app = express();

//Enable CORS for all routes: React development works without browser security blocks
app.use(cors());

//Built-in middleware that auto-parses incoming json request bodies, attaches to req.body
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

//Wrap Express app inside a raw Node HTTP server
const server = createServer(app);

//Attach WebSocket to that same HTTP server on '/ws' subpath.
const wss = new WebSocketServer({ server, path: '/ws' });

//Store target alarm as 24 hour HH:MM string format, null if no alarm set yet.
//This variable will store the actual alarm.
let activeAlarm = null;

//Track whether alarm is ringing or not.
let isRinging = false;

//This function sens a json event to every open browser tab/kisok view.
function broadcast(payload) {
    const message = JSON.stringify(payload);

    //Loop over all connected clients 
    wss.clients.forEach(client => {
        //Verify that socket is open before sending
        if (client.readyState === WebSocket.OPEN) client.send(message);
    }); //forEach
} //broadcast

//Checking current alarm
app.get('/api/status', (req, res) => {
    //Check the current alarm status and set the message accordingly.
    let alarmText = "There is currently no alarm set.";
    if (activeAlarm !== null) alarmText = activeAlarm;

    //Send a json object back to the frontend
    res.json({
        alarm: alarmText,
        ringing: isRinging
    }); //res.json
}); //app.get

//Setting new alarm
app.post('/api/alarm', (req, res) => {
    const time = req.body.time;

    //Set the new alarm time
    activeAlarm = time;
    //Since the alarm has not rung yet, make sure the isRinging boolean is set to false to that it can be turned off when it rings
    isRinging = false;

    //Call the broadcast function with the json object of both
    broadcast({
        type: 'ALARM_SET',
        time: activeAlarm
    }); //broadcast

    //Return the updated state back to the caller
    res.json({ 
        alarm: activeAlarm, 
        ringing: isRinging
    }); //res.json
}); //app.post

//Stopping an alarm when ringing
app.post('/api/alarm/stop', (req, res) => {
    isRinging = false;
    activeAlarm = null;

    broadcast({ type: 'ALARM_STOPPED' });

    res.json({
        alarm: 'NONE',
        ringing: false
    }); //res.json
}) //app.post

//Run a check every second to see if the alarm should ring
setInterval(() => {
    //Return if there is no alarm or the alarm is currently ringing.
    if (activeAlarm === null || isRinging === true) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentHM = `${hours}:${minutes}`;

    //If the current time is equal to the set alarm, sound the alarm.
    if (currentHM === activeAlarm) {
        isRinging = true;
        broadcast({
            type: 'ALARM_TRIGGER',
            time: activeAlarm
        }); //broadcast
    } //if
}, 1000); //setInterval

const PORT = 8000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart clock backend running on http://localhost:${PORT}`);
}); //server.listen