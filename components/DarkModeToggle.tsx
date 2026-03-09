'use client'

import { motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/ThemeProvider'

/**
 * Animated dark mode toggle — sun/moon swap with rotation animation.
 * Drop this into any dashboard header.
 */
export default function DarkModeToggle() {
    const { theme, toggleTheme } = useTheme()
    const isDark = theme === 'dark'

    return (
        <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all duration-300 ${isDark
                    ? 'bg-slate-700 border-slate-600 text-amber-400 hover:bg-slate-600 shadow-lg shadow-slate-900/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
                }`}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <motion.div
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
            >
                {isDark ? (
                    <Sun className="w-5 h-5" />
                ) : (
                    <Moon className="w-5 h-5" />
                )}
            </motion.div>
        </motion.button>
    )
}
