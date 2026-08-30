import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import CountUp from 'react-countup';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  iconColor: string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  delay?: number;
}

export function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  iconColor, 
  subtitle,
  trend,
  delay = 0 
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="p-6 border border-border bg-card transition-all duration-300 group rounded-[2px]">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-[4px] ${iconColor} transition-all duration-300`}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <div className={`text-xs font-medium px-2 py-1 rounded-[2px] ${
              trend.isPositive 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            }`}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </div>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">
            <CountUp end={value} duration={1.5} separator="." />
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
