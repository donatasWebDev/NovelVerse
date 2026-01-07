// SocketContext.tsx
import { createContext, useContext, ReactNode, useEffect } from "react";
import { useSocket } from "./useSocket";
import { useLocation } from "react-router-dom";

export type SocketContextType = ReturnType<typeof useSocket> | null;

const SocketContext = createContext<SocketContextType>(null);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
    const socket = useSocket();
    const location = useLocation();

    useEffect(() => {
        const inPlayRoute = location.pathname.includes("/play/");
        if (socket.isConnected) {
            if (!inPlayRoute) {
                console.log("Left play route – disconnecting socket");
                socket.disconnect();
                return;
            }

            socket.clearAudioBuffer()
            socket.disconnect();
        }

    }, [location.key]);  // socket in deps to avoid stale closure

    return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocketContext = () => {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error("useSocketContext must be used inside <SocketProvider>");
    return ctx;
};
