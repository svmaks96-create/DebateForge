import { useState, useEffect, useRef, useCallback } from 'react';

export default function useDebateStream(debateId) {
  const [status, setStatus] = useState('connecting');
  const [currentRound, setCurrentRound] = useState(null);
  const [arguments_, setArguments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [synthesis, setSynthesis] = useState(null);
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
      // Connection established
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
      const arg = {
        argument_index: data.argument_index,
        agent_prefix: data.agent_prefix,
        agent_title: data.agent_title,
        seat_number: data.seat_number,
        stance: data.stance || 'neutral',
        confidence: data.confidence ?? 5,
        claim: data.claim || '',
        summary: data.summary || '',
        arg_type: data.arg_type || 'claim',
        targets: data.targets || [],
        roundNumber: data.round_number,
      };
      setArguments((prev) => [...prev, arg]);
    });

    es.addEventListener('round_end', (e) => {
      const data = JSON.parse(e.data);
      setCurrentRound((prev) =>
        prev ? { ...prev, completed: true } : prev
      );
    });

    es.addEventListener('reflecting_start', () => {
      setStatus('reflecting');
    });

    es.addEventListener('position', (e) => {
      const data = JSON.parse(e.data);
      setPositions((prev) => [...prev, {
        agent_prefix: data.agent_prefix,
        agent_title: data.agent_title,
        overall_stance: data.overall_stance,
        confidence: data.confidence,
        position_summary: data.position_summary,
      }]);
    });

    es.addEventListener('verification_start', () => {
      setStatus('verifying');
    });

    es.addEventListener('verification_complete', () => {
      // Verification done, synthesis will start next
    });

    es.addEventListener('synthesis_start', () => {
      setStatus('synthesizing');
    });

    es.addEventListener('debate_complete', (e) => {
      const data = JSON.parse(e.data);
      setStatus('completed');
      setSynthesis({
        bottom_line: data.bottom_line,
        confidence_level: data.confidence_level || 'uncertain',
      });
      disconnect();
    });

    es.addEventListener('error', (e) => {
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
      // EventSource built-in error — auto-reconnects
    };

    return () => {
      disconnect();
    };
  }, [debateId, disconnect]);

  return {
    status,
    currentRound,
    arguments: arguments_,
    positions,
    synthesis,
    totalRounds,
    error,
    disconnect,
  };
}
