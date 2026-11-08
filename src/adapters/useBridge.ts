import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { INITIAL_STATE, decode, type ContractState, type Message } from "../core/contract.ts";

const RETRY_MS = 2000;
const RESET = { type: "__reset" } as const;

// Robot serves page, so page host is robot. ?robot=host:port overrides
export function robotUrl(port = 8765): string {
  const robot = new URLSearchParams(window.location.search).get("robot");
  return `ws://${robot ?? `${window.location.hostname || "localhost"}:${port}`}`;
}

export type Bridge = { state: ContractState; connected: boolean; send: (command: Message) => void };

export function useBridge(url: string = robotUrl()): Bridge {
  const [state, dispatch] = useReducer(
    (s: ContractState, m: Message) => (m === RESET ? INITIAL_STATE : decode(s, m, Date.now())), INITIAL_STATE);
  const [connected, setConnected] = useState(false);
  const socket = useRef<WebSocket | null>(null);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      const ws = new WebSocket(url);
      socket.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (event) => {
        try {
          dispatch(JSON.parse(event.data) as Message);
        } catch {
          // Not JSON, not contract
        }
      };
      ws.onclose = () => {
        setConnected(false);
        dispatch(RESET);
        if (!closed) retry = setTimeout(open, RETRY_MS);
      };
    };
    open();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket.current?.close();
    };
  }, [url]);

  const send = useCallback((command: Message) => {
    const ws = socket.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(command));
  }, []);

  return { state, connected, send };
}
