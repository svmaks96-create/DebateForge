import { useState, useEffect, useRef, useCallback } from 'react';

export default function useDebateStream(debateId) {
  const [status, setStatus] = useState('connecting');
  const [currentRound, setCurrentRound] = useState(null);
  const [arguments_, setArguments] = useState({ pro: [], con: [] });
  const [verdict, setVerdict] = useState(null);
  const [totalRounds, setTotalRounds] = useState(0);
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  const disconnect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!debateId) return;

    const es = new EventSource(`/api/debates/${debateId}/stream`, {
      withCredentials: true,
    });
    esRef.current = es;

    es.addEventListener('connected', () => {
      // Connection established, wait for debate events
    });

    es.addEventListener('debate_start', (e) => {
      const data = JSON.parse(e.data);
      setStatus('running');
      setTotalRounds(data.total_rounds || 0);
    });

    es.addEventListener('round_start', (e) => {
      const data = JSON.parse(e.data);
      setCurrentRound({
        number: data.round_number,
        type: data.round_type,
      });
    });

    es.addEventListener('argument', (e) => {
      const data = JSON.parse(e.data);
      const side = data.side; // "pro" or "con"
      const newArgs = (data.arguments || []).map((arg) => ({
        ...arg,
        side,
        agentPrefix: data.agent_prefix,
        agentTitle: data.agent_title,
        roundNumber: data.round_number,
        summary: data.summary,
      }));

      setArguments((prev) => ({
        ...prev,
        [side]: [...prev[side], ...newArgs],
      }));
    });

    es.addEventListener('round_end', (e) => {
      const data = JSON.parse(e.data);
      setCurrentRound((prev) =>
        prev ? { ...prev, completed: true } : prev
      );
    });

    es.addEventListener('judging_start', () => {
      setStatus('judging');
    });

    es.addEventListener('debate_complete', (e) => {
      const data = JSON.parse(e.data);
      setStatus('completed');
      setVerdict(data.verdict);
      disconnect();
    });

    es.addEventListener('error', (e) => {
      // SSE error event — could be a server-sent error or connection failure
      if (e.data) {
        try {
          const data = JSON.parse(e.data);
          setError(data.message || 'Unknown error');
        } catch {
          setError('Connection error');
        }
      }
      setStatus('error');
    });

    es.onerror = () => {
      // EventSource built-in error (connection lost, etc.)
      // Don't immediately set error — EventSource auto-reconnects
    };

    return () => {
      disconnect();
    };
  }, [debateId, disconnect]);

  return {
    status,
    currentRound,
    arguments: arguments_,
    verdict,
    totalRounds,
    error,
    disconnect,
  };
}
