import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  onDateRangeChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  className?: string;
  placeholder?: string;
  showDaysBadge?: boolean;
}

export const DateRangePicker = ({ 
  dateRange, 
  onDateRangeChange, 
  className,
  placeholder = "Selecionar período",
  showDaysBadge = true
}: DateRangePickerProps) => {
  // Local state for visual selection
  const [localRange, setLocalRange] = useState<{from: Date | undefined; to: Date | undefined}>({
    from: dateRange.from,
    to: dateRange.to
  });

  // Sync local state with prop changes
  useEffect(() => {
    setLocalRange({ from: dateRange.from, to: dateRange.to });
  }, [dateRange.from, dateRange.to]);

  const formatDateRange = () => {
    if (!localRange.from) return placeholder;
    if (!localRange.to) return format(localRange.from, "dd/MM/yyyy", { locale: ptBR });
    return `${format(localRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(localRange.to, "dd/MM/yyyy", { locale: ptBR })}`;
  };

  const hasValidDateRange = localRange.from && localRange.to;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal rounded-[4px] px-3 py-2",
              !dateRange.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-1 h-4 w-4 flex-shrink-0" />
            <span className="text-left">{formatDateRange()}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={localRange.from}
            selected={localRange}
            onSelect={(range) => {
              // Always update local state for visual feedback
              setLocalRange({
                from: range?.from,
                to: range?.to
              });
              
              // Only call the parent change handler when both dates are selected
              if (range?.from && range?.to) {
                onDateRangeChange({ from: range.from, to: range.to });
              }
            }}
            numberOfMonths={2}
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      
      {showDaysBadge && hasValidDateRange && (
        <Badge variant="secondary" className="text-sm">
          {Math.ceil((localRange.to!.getTime() - localRange.from!.getTime()) / (1000 * 60 * 60 * 24))} dias
        </Badge>
      )}
    </>
  );
};