import { useState, useEffect, useRef, useCallback } from 'react'

const WS_URL = 'ws://localhost:8000/ws/agent-stream'
const API_BASE = 'http://localhost:8000'

/**
 * useSimulation — manages WebSocket connection and simulation state.
 *
 * Exposes:
 *   agentMessages  — array of {agent, message, timestamp} objects
 *   decision       — final Decision object or null
 *   status         — "MONITORING" | "ANALYZING" | "DECIDING" | "VALIDATING" | "AVOIDED" | "ERROR"
 *   satellites     — satellite list from /api/satellites
 *   events         — conjunction events from /api/events
 *   isRunning      — true while pipeline is executing
 *   triggerScenario(kessler?) — POST /api/trigger-scenario
 *   reset()        — POST /api/reset and clear local state
 *   connected      — WebSocket connection status
 */
export function useSimulation() {
  const [agentMessages, setAgentMessages] = useState([])
  const [decision, setDecision] = useState(null)
  const [status, setStatus] = useState('MONITORING')
  const [satellites, setSatellites] = useState([])
  const [events, setEvents] = useState([])
  const [conjunctions, setConjunctions] = useState([])
  const [stats, setStats] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [connected, setConnected] = useState(false)

  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)

  // Load static data on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/satellites`)
      .then(r => r.json())
      .then(d => setSatellites(d.satellites || []))
      .catch(() => {})

    fetch(`${API_BASE}/api/events`)
      .then(r => r.json())
      .then(d => setEvents(d.events || []))
      .catch(() => {})

    fetch(`${API_BASE}/api/conjunctions`)
      .then(r => r.json())
      .then(d => setConjunctions(d.conjunctions || []))
      .catch(() => {})

    fetch(`${API_BASE}/api/stats`)
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {})
  }, [])

  // WebSocket connection with auto-reconnect
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
    }

    ws.onmessage = (evt) => {
      let msg
      try { msg = JSON.parse(evt.data) } catch { return }

      switch (msg.type) {
        case 'agent_log':
          setAgentMessages(prev => [...prev, {
            agent: msg.agent,
            message: msg.message,
            timestamp: msg.timestamp,
          }])
          break

        case 'decision':
          setDecision(msg.data)
          break

        case 'status':
          setStatus(msg.status)
          if (msg.status === 'AVOIDED' || msg.status === 'ERROR') {
            setIsRunning(false)
          }
          break

        case 'error':
          setStatus('ERROR')
          setIsRunning(false)
          setAgentMessages(prev => [...prev, {
            agent: 'system',
            message: `ERROR: ${msg.message}`,
            timestamp: msg.timestamp || new Date().toISOString(),
          }])
          break

        default:
          break
      }
    }

    ws.onclose = () => {
      setConnected(false)
      // Auto-reconnect after 2 seconds
      reconnectTimer.current = setTimeout(connect, 2000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [connect])

  const triggerScenario = useCallback(async (kessler = false, eventId = null) => {
    if (isRunning) return
    setIsRunning(true)
    setStatus('ANALYZING')
    setAgentMessages([])
    setDecision(null)

    try {
      await fetch(`${API_BASE}/api/trigger-scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kessler, event_id: eventId }),
      })
    } catch (e) {
      setStatus('ERROR')
      setIsRunning(false)
    }
  }, [isRunning])

  const reset = useCallback(async () => {
    setAgentMessages([])
    setDecision(null)
    setStatus('MONITORING')
    setIsRunning(false)

    try {
      await fetch(`${API_BASE}/api/reset`, { method: 'POST' })
    } catch (e) {}
  }, [])

  return {
    agentMessages,
    decision,
    status,
    satellites,
    events,
    conjunctions,
    stats,
    isRunning,
    connected,
    triggerScenario,
    reset,
  }
}
