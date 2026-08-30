import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { useTranslation } from "@/hooks/useTranslation";

interface DateRangeFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangeFilter({ 
  dateRange, 
  onDateRangeChange, 
  className 
}: DateRangeFilterProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange | undefined>(dateRange);

  const formatDateRange = () => {
    if (!dateRange?.from) return t('conversations.dateRangeFilter.selectPeriod');
    if (!dateRange?.to) return format(dateRange.from, "MM/dd/yyyy");
    return `${format(dateRange.from, "MM/dd/yyyy")} - ${format(dateRange.to, "MM/dd/yyyy")}`;
  };

  const handleApply = () => {
    if (tempRange?.from && tempRange?.to) {
      onDateRangeChange(tempRange);
      setIsOpen(false);
    }
  };

  const handleCancel = () => {
    setTempRange(dateRange);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempRange(undefined);
    onDateRangeChange(undefined);
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setTempRange(dateRange);
    }
  };

  const getDaysCount = () => {
    if (!tempRange?.from || !tempRange?.to) return null;
    const days = Math.ceil((tempRange.to.getTime() - tempRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysLabel = days === 1 ? t('conversations.dateRangeFilter.day') : t('conversations.dateRangeFilter.days');
    return `${days} ${daysLabel}`;
  };

  const hasValidSelection = tempRange?.from && tempRange?.to;
  const hasDateRange = dateRange?.from && dateRange?.to;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal rounded-[4px] h-[30px] text-xs",
            !hasDateRange && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
          <span className="flex-1 truncate">{formatDateRange()}</span>
          {hasDateRange && (
            <X
              className="ml-2 h-4 w-4 flex-shrink-0 hover:text-destructive transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" side="bottom">
        <div className="p-3">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={tempRange?.from || new Date()}
            selected={tempRange}
            onSelect={setTempRange}
            numberOfMonths={2}
            disabled={(date) => date > new Date()}
            className="pointer-events-auto"
          />
          
          {getDaysCount() && (
            <div className="px-3 py-2 text-center text-sm text-muted-foreground border-t">
              {getDaysCount()} {t('conversations.dateRangeFilter.selected')}
            </div>
          )}
          
          <div className="flex items-center justify-between gap-2 px-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="flex-1 rounded-[4px]"
            >
              {t('conversations.dateRangeFilter.clear')}
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!hasValidSelection}
              className="flex-1 rounded-[4px]"
            >
              {t('conversations.dateRangeFilter.apply')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
