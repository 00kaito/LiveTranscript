import { motion } from "framer-motion";

export function LiveIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-full border border-red-500/20">
      <span className="relative flex h-2.5 w-2.5">
        <motion.span
          animate={{ scale: [1, 1.5, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"
        />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
      </span>
      <span className="text-xs font-semibold text-red-600 tracking-wide uppercase">Live</span>
    </div>
  );
}
