import { useState } from 'react'
import { motion } from 'motion/react'

export function Home() {
  const [count, setCount] = useState(0)

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.h1
        className="text-4xl font-bold tracking-tight"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Hello World
      </motion.h1>
      <motion.div
        className="flex items-center gap-4"
        key={count}
        initial={{ scale: 0.8, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <button
          onClick={() => setCount((c) => c - 1)}
          className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition"
        >
          -1
        </button>
        <span className="text-3xl font-mono tabular-nums w-16 text-center">{count}</span>
        <button
          onClick={() => setCount((c) => c + 1)}
          className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition"
        >
          +1
        </button>
      </motion.div>
    </div>
  )
}