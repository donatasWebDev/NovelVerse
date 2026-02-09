import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { BottomNav } from "./components/BottomNav";
import { SideNav } from "./components/SideNav";
import { TopNav } from "./components/TopNav";

import { SearchPage } from "./pages/SearchPage";
import { LibraryPage } from "./pages/LibraryPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { PlayerMiddle } from "./components/PlayerMiddle";
import { HomeRouteWrapper } from "./components/homeRouteWrapper";

import { AuthProvider } from "./uttils/AuthContex";
import { LibraryProvider } from "./uttils/LibraryContext";
import { SocketProvider } from "./uttils/socketContext";
import { Toaster } from "sonner";


export function App() {
  return (
    <AuthProvider>
      <LibraryProvider>
        <SocketProvider>
          <Toaster
            position="top-right"     // or "bottom-center", etc.
            richColors               // nice colors for success/error/warning
            closeButton              // optional X button
            duration={0}             // optional: make persistent toasts stay longer by default
          />
          <div className="min-h-screen min-w-screen bg-gray-900">
            <SideNav />
            <TopNav />
            <div className="lg:ml-64 min-h-screen ">
              <main className="container mx-auto px-10 mb-16 lg:mb-0 flex flex-col py-8 relative min-w-full min-h-screen">
                <Routes>
                  <Route path="/" element={<HomeRouteWrapper />} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/library" element={<LibraryPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />


                  <Route path="/play/:p_id/:nr" element={<PlayerMiddle />} />
                </Routes>
              </main>
            </div>
            <BottomNav />
          </div>
        </SocketProvider>
      </LibraryProvider>
    </AuthProvider>
  );
}
