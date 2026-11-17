import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  //State variables
  const [now, setNow] = useState(new Date()); //Holds current Date object, updates every second
  const [alarmInput, setAlarmInput] = useState('10:09');  //Holds whatever time picked in <input type="time"> box
  const [activeAlarm, setActiveAlarm] = useState('NONE'); //Holds currently saved alarm on the backend, if any. ('NONE' or 'HH:MM')
  const [ringing, setRinging] = useState(false);

  const audioCtxRef = useRef(null); //Generate an alarm beep without an MP3 file

  let apiBaseUrl = '';
  let wsUrl = 'ws://' + window.location.host + '/ws';
  if (window.location.port === '5173') {
    apiBaseUrl = 'http://localhost:8000';
    wsUrl = 'ws://localhost:8000/ws';
  }

  //Update each second (clock tick)
  useEffect(() => {
    const clockTimer = setInterval(() => { setNow(new Date()); }, 1000);

    //if the component unmounts, stop the timer.
    return () => clearInterval(clockTimer);
  }, []); //useEffect

  //Backend sync, websocket connection
  useEffect(() => {
    //Fetch initial alarm status when page loads
    fetch(apiBaseUrl + '/api/status')
      .then((response) => response.json())
      .then((data) => {
        setActiveAlarm(data.alarm);
        setRinging(data.ringing);
      })
      .catch((error) => {
        console.error('Could not fetch initial status:', error);
      });

    // Next, open a persistent WebSocket connection to listen for live events
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'ALARM_SET') {
        setActiveAlarm(message.time);
        setRinging(false);
      } else if (message.type === 'ALARM_TRIGGER') {
        setRinging(true);
      } else if (message.type === 'ALARM_STOPPED') {
        setRinging(false);
        setActiveAlarm('NONE');
      }
    };

    //Close the WebSocket cleanly if the page refreshes or closes
    return () => {
      ws.close();
    };
  }, [apiBaseUrl, wsUrl]); //useEffect


  //Play repeating beep using browser's built-in Web Audio API if ringing
  useEffect(() => {
    if (ringing === false) {
      return;
    }

    const beepInterval = setInterval(() => {
      if (audioCtxRef.current === null) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;

      const oscillator = ctx.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.25); //Beep lasts 0.25 seconds
    }, 600);

    return () => {
      clearInterval(beepInterval);
    };
  }, [ringing]); //useEffect

  //Button handlers sending POST requests to server.js
  async function handleSetAlarm() {
    if (audioCtxRef.current === null) {
      audioCtxRef.current = new AudioContext();
    }

    try {
      const response = await fetch(apiBaseUrl + '/api/alarm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: alarmInput })
      });
      const data = await response.json();
      setActiveAlarm(data.alarm);
      setRinging(data.ringing);
    } catch (error) {
      console.error('Failed to set alarm:', error);
    }
  } //handleSetAlarm

  async function handleStopAlarm() {
    try {
      const response = await fetch(apiBaseUrl + '/api/alarm/stop', {
        method: 'POST'
      });
      const data = await response.json();
      setActiveAlarm(data.alarm);
      setRinging(data.ringing);
    } catch (error) {
      console.error('Failed to stop alarm:', error);
    }
  } //handleStopAlarm

  //Format the current time as HH:MM:SS
  const timeString = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }); //timeString

  //Switch background to red when the alarm is ringing
  let backgroundColor = '#0f172a';
  if (ringing === true) {
    backgroundColor = '#7f1d1d';
  } //if

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: backgroundColor,
        color: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
        gap: '1.25rem'
      }}
    >
      {/* Large Digital Clock */}
      <div style={{ fontSize: '5.5rem', fontWeight: 700, letterSpacing: '2px' }}>
        {timeString}
      </div>

      {/* Current Alarm Status */}
      <div style={{ fontSize: '1.35rem', color: '#cbd5e1', paddingTop: '2em', paddingBottom: '1em' }}>
        Alarm: <strong>{activeAlarm && activeAlarm.includes(':') ? new Date(`1970-01-01T${activeAlarm}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'No alarm set.'}</strong>
      </div>

      {/* Show STOP button if ringing, otherwise show Time Picker + Set button */}
      {ringing === true ? (
        <button
          onClick={handleStopAlarm}
          style={{
            padding: '1rem 2.5rem',
            fontSize: '1.5rem',
            fontWeight: 700,
            backgroundColor: '#ef4444',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer'
          }}
        >
          STOP ALARM
        </button>
      ) : (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="time"
            value={alarmInput}
            onChange={(e) => setAlarmInput(e.target.value)}
            style={{
              fontSize: '1.35rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              border: 'none'
            }}
          />
          <button
            onClick={handleSetAlarm}
            style={{
              padding: '0.65rem 1.5rem',
              fontSize: '1.35rem',
              fontWeight: 600,
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Set Alarm
          </button>
        </div>
      )}
    </div>
  );
} //App

export default App
