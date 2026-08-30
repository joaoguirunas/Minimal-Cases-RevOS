import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

interface CountdownCircularProps {
  seconds: number;
  totalSeconds?: number;
}

export function CountdownCircular({ seconds, totalSeconds = 60 }: CountdownCircularProps) {
  const progress = totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  // Color based on remaining time
  const getColor = () => {
    const percentage = (seconds / totalSeconds) * 100;
    if (percentage > 66) return 'hsl(var(--primary))';
    if (percentage > 33) return 'hsl(45 93% 47%)'; // amber
    return 'hsl(0 84% 60%)'; // red
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        {/* Background Circle */}
        <svg className="w-full h-full -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="hsl(var(--muted))"
            strokeWidth="8"
            fill="none"
            opacity="0.2"
          />
          {/* Progress Circle */}
          <motion.circle
            cx="64"
            cy="64"
            r={radius}
            stroke={getColor()}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </svg>
        
        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            key={seconds}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            <span className="text-4xl font-bold text-foreground">{seconds}</span>
            <span className="text-xs text-muted-foreground">segundos</span>
          </motion.div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="w-4 h-4" />
        <span>Próximo envio</span>
      </div>
    </div>
  );
}
