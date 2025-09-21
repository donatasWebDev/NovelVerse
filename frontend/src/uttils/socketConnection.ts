import { useState, useEffect, useCallback, useRef } from 'react';

const URL = 'ws://26.8.146.141:12345';

export const useSocket = (url: string = URL) => {
    const socketRef = useRef<WebSocket | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [socket,setSocket] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    let appendQueue = []; 
    let isAppending = false;
    const [data, setData] = useState<any>({
        key: null,
        user_id: null
    });
    const [audio, setAudio] = useState<ArrayBuffer[]>([]);

    const connect = useCallback((key:string, user_id:string) => {
        if (socketRef.current) {
            socketRef.current.close();
        }
        const newSocket = new WebSocket(url);
        newSocket.onopen = () => {
            console.log('WebSocket connected');
            setSocket(newSocket)
            setIsConnected(true);
            setError(null);
            setData({ key: key, user_id: user_id });
            sendMessage(`${key},${user_id}`);
        };

        newSocket.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            setIsConnected(false);
        };

        newSocket.onmessage = (event) => {
            let data: any;
            try {
                let obj =  JSON.parse(event.data)
                console.log(obj)
                if (obj.type == "info"){
                    console.log("message: ", obj.message )
                    data = JSON.parse(obj.toString());
                }
                if (obj.type == "audio"){
                    const base64 = obj.message.audio_bytes;
                    const binaryString = atob(base64);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                    
                    // Add the new chunk to the appendQueue
                    appendQueue.push(bytes.buffer);
                    setAudio( (prev) => [...(prev || []), bytes.buffer ] );
                    // setAudio(appendQueue)
                    
                    // Try to start appending immediately if not already doing so
                    // attemptAppend();
                }
                else {
                    console.log("got message type: ",obj.type )
                    console.log(obj)
                }
            } catch (e) {
                data = event.data; // If not JSON, use raw data
            }
            setMessages((prevMessages) => [...prevMessages, data]);
        };

        newSocket.onerror = (err:any) => {
            console.error('WebSocket error:', err);
            setError(err);
        };

        socketRef.current = newSocket;
        setData({key: key, user_id: user_id})
        return newSocket;
    }, [url]);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.close();
        }
    }, [socketRef.current]);

    const sendMessage = useCallback((message: any) => {
        console.log("sending message", message)
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            try {
                if (isJson(message)){
                    socketRef.current.send(JSON.stringify(message));
                }
                else {
                    socketRef.current.send(message);
                }

            } catch (err) {
                console.error('Error sending message:', err);
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        } else {
            setError(new Error('WebSocket not connected'));
        }
    }, [socketRef.current]);

    // function attemptAppend() {
    //     if (!sourceBufferRef.current || sourceBufferRef.current.updating || appendQueue.length === 0 || isAppending) {
    //         // Not ready to append: no source buffer, currently updating, no chunks in queue, or already in progress
    //         return;
    //     }

    //     isAppending = true; // Set flag to indicate an append operation is starting
    //     const chunkToAppend = appendQueue.shift(); // Get the next chunk from the queue

    //     try {
    //         sourceBufferRef.current.appendBuffer(chunkToAppend);
    //     } catch (e) {
    //         console.error("Error during appendBuffer:", e);
    //         isAppending = false; // Reset flag on error
    //         // Handle error: perhaps clear queue, close connection, etc.
    //     }
    // }

    // useEffect( () => {
    //     if (data.key && data.user_id){
    //         sendMessage(`${data.key},${data.user_id}`)
    //     }
    // },[isConnected])

    function isJson(value:any) {
        try {
            // Try to parse the value as JSON
            JSON.parse(value);
            return true;  // It's a valid JSON string
        } catch (e) {
            return false;  // It's a regular string
        }
    }
    // setSocket(socketRef.current)
    return {
        socket,
        messages,
        sendMessage,
        isConnected,
        disconnect,
        error,
        connect,
        audio,
    };
};