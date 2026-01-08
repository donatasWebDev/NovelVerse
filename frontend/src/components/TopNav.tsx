import { Link } from "react-router-dom";
import { useEffect, useState, useRef } from 'react'
import { Settings, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from "../uttils/AuthContex";
interface MobileProfileDropdownProps {
  avatarUrl?: string
  username?: string
  handle?: string
}
export const TopNav = () => {
  return <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
      <Link to={"/"} className="text-xl font-bold text-gray-100">NovelVerse</Link>
      <button className="">
        <MobileProfileDropdown/>
      </button>
    </div>;
};

export function MobileProfileDropdown({
  avatarUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=150&q=80',
}: MobileProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { user, handleUserLogout } = useAuth()!
  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  useEffect(() => {
    console.log("isOpen", isOpen)
  }, [isOpen])
  if (!user) {
    return null
  }
  return (
    <div className="relative rounded-full" ref={dropdownRef}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative ring-slate-600 rounded-full overflow-hidden focus:outline-none focus:ring-2 transition-all active:scale-95"
        aria-label="Open profile menu"
        aria-expanded={isOpen}
      >
        <img
          src={avatarUrl}
          alt={user.name}
          className="w-12 h-12 object-cover"
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{
              opacity: 0,
              y: 10,
              scale: 0.95,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 10,
              scale: 0.95,
            }}
            transition={{
              duration: 0.2,
              ease: 'easeOut',
            }}
            className="absolute right-0 mt-3 w-72 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 overflow-hidden z-50 origin-top-right"
          >
            {/* Profile Header Section */}
            <div className="p-5 border-b border-slate-700/50">
              <div className="flex items-center gap-4">
                <img
                  src={avatarUrl}
                  alt={user.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-slate-600"
                />
                <div className="flex flex-col">
                  <span className="text-white font-bold text-lg tracking-wide">
                    {user.name.charAt(0).toUpperCase() + user.name.slice(1)}
                  </span>
                  <span className="text-slate-400 text-sm text-left font-medium">
                    {`@${user.name.toLowerCase()}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              <button
                className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-slate-700/50 active:bg-slate-700 transition-colors group"
                role="menuitem"
              >
                <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-slate-700 transition-colors">
                  <Settings className="w-6 h-6 text-slate-300" />
                </div>
                <span className="text-slate-300 text-lg font-medium">
                  Settings
                </span>
              </button>

              <button
                className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-red-500/10 active:bg-red-500/20 transition-colors group mt-1"
                role="menuitem"
              >
                <div className="p-2 rounded-lg bg-slate-800 group-hover:bg-slate-700/50 transition-colors">
                  <LogOut className="w-6 h-6 text-red-500" />
                </div>
                <span className="text-red-400 text-lg font-medium">Logout</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
