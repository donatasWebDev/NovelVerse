import { useState, useRef, useCallback } from "react";

const DEFAULT_URL = import.meta.env.VITE_WS_URL || "Test_env_value_socket";


export const useSocket = (url: string = DEFAULT_URL) => {
    const socketRef = useRef<WebSocket | null>(null);

    const [messages, setMessages] = useState<any[]>([]);
    const [audio, setAudio] = useState<ArrayBuffer[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [data, setData] = useState<{ key: string| null; user_id: string | null }>();

    const connect = useCallback((key: string, user_id: string) => {
        if (socketRef.current) {
            socketRef.current.close();
        }

        const ws = new WebSocket(url);

        ws.onopen = () => {
            console.log("WebSocket connected");
            socketRef.current = ws;
            setIsConnected(true);
            setData({ key, user_id });
            sendMessage(`${key},${user_id}`);
        };

        ws.onclose = () => {
            console.log("WebSocket disconnected");
            setIsConnected(false);
        };

        ws.onerror = (err) => {
            console.error("WebSocket error:", err);
            setError(err as any);
        };

        ws.onmessage = (event) => {
            try {
                const obj = JSON.parse(event.data);

                if (obj.type === "audio") {
                    const base64 = obj.message.audio_bytes;
                    const binaryString = atob(base64);
                    const buffer = new Uint8Array(binaryString.length);

                    for (let i = 0; i < binaryString.length; i++) {
                        buffer[i] = binaryString.charCodeAt(i);
                    }

                    setAudio((prev) => [...prev, buffer.buffer]);
                    console.log("Received audio chunk", buffer.buffer);
                } else {
                    console.log("Received message:", obj);
                    setMessages((prev) => [...prev, obj]);
                }
            } catch (e) {
                console.error("Message parse error:", e);
            }
        };

        socketRef.current = ws;
    }, [url]);

    const disconnect = useCallback(() => {
        console.log("Disconnecting socket");
        const sock = socketRef.current;

        if (!sock) {
            console.log("No active socket to close");
            return;
        }

        sock.close();
        socketRef.current = null;

        setIsConnected(false);
        setMessages([]);
        setAudio([]);
    }, []);

    const sendMessage = useCallback((message: any) => {
        const sock = socketRef.current;

        if (!sock || sock.readyState !== WebSocket.OPEN) {
            setError(new Error("WebSocket not connected"));
            return;
        }

        try {
            const msg = typeof message === "object" ? JSON.stringify(message) : message;
            sock.send(msg);
        } catch (err) {
            console.error("Send error:", err);
            setError(err instanceof Error ? err : new Error(String(err)));
        }
    }, []);

    return { connect, disconnect, sendMessage, messages, audio, isConnected, socketRef, error, data };
};
