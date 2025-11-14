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
        // If the path looks like /3/play/xxxx/1
        const shouldConnect = location.pathname.includes("/play/");

        if (!shouldConnect) {
            socket.disconnect();
        }
    }, [location.pathname]);
    return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocketContext = () => {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error("useSocketContext must be used inside <SocketProvider>");
    return ctx;
};
