import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PHONE_COUNTRIES, detectCountryFromPhone, PhoneCountry } from "@/utils/phoneUtils";

// ─── Brazil formatting ────────────────────────────────────────────────────────
// digits = raw digits WITHOUT country code (max 11: DDD(2) + number(9))
// returns formatted display like "(48) 9 9189-8486"
function formatBrazilDisplay(digits: string): string {
  const d = digits.slice(0, 11);
  if (!d) return '';
  const ddd = d.slice(0, 2);
  const num = d.slice(2);
  if (d.length <= 2) return `(${ddd}`;
  if (!num) return `(${ddd})`;
  if (num.length <= 4) return `(${ddd}) ${num}`;
  if (num.length <= 8) return `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
  return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`; // 9-digit: XXXXX-XXXX
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WhatsAppInputProps {
  value: string;
  onChange: (displayValue: string, dbValue: string) => void;
  label?: string;
  className?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
}

const WhatsAppInput = ({
  value,
  onChange,
  label = "WhatsApp",
  className,
  error,
  disabled = false,
  required = false,
  autoFocus = false,
}: WhatsAppInputProps) => {
  const [country, setCountry] = useState<PhoneCountry>(PHONE_COUNTRIES[0]);
  const [displayValue, setDisplayValue] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  // Initialize from stored DB value
  useEffect(() => {
    if (initialized.current) return;
    const digits = (value || '').replace(/\D/g, '');
    if (!digits) return;
    initialized.current = true;

    const detected = detectCountryFromPhone(digits);
    const c = detected || PHONE_COUNTRIES[0];
    setCountry(c);
    const national = digits.slice(c.dialCode.length);
    setDisplayValue(c.code === 'BR' ? formatBrazilDisplay(national) : national);
  }, [value]);

  const selectCountry = (c: PhoneCountry) => {
    setCountry(c);
    setDisplayValue('');
    onChange('', '');
    setPopoverOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    if (country.code === 'BR') {
      const digits = raw.replace(/\D/g, '').slice(0, 11);
      const formatted = formatBrazilDisplay(digits);
      setDisplayValue(formatted);

      // Emit when complete
      if (digits.length >= 10) {
        const dddNum = parseInt(digits.slice(0, 2));
        if (dddNum >= 11 && dddNum <= 99) {
          const db = '55' + digits;
          onChange(formatted, db);
        } else {
          onChange('', '');
        }
      } else {
        onChange('', '');
      }
    } else {
      const digits = raw.replace(/\D/g, '').slice(0, country.maxDigits);
      setDisplayValue(digits);
      if (digits.length >= 6) {
        onChange(`+${country.dialCode} ${digits}`, country.dialCode + digits);
      } else {
        onChange('', '');
      }
    }
  };

  const showError = !!error;
  const placeholder = country.code === 'BR' ? '(48) 9 9999-9999' : country.placeholder;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label className="text-xs font-medium text-muted-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {/* Unified input group */}
      <div
        className={cn(
          "flex items-center h-[30px] w-full rounded-[4px] border bg-background transition-colors",
          focused
            ? "border-ring ring-2 ring-ring/20"
            : "border-input",
          showError && "border-destructive ring-2 ring-destructive/20",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {/* Flag + chevron (country picker trigger) */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex items-center gap-1 h-full px-2.5 rounded-l-[3px]",
                "border-r border-input bg-muted hover:bg-muted/50",
                "transition-colors shrink-0 focus:outline-none",
              )}
              onClick={() => setPopoverOpen(true)}
            >
              <span className="text-[16px] leading-none">{country.flag}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground/60" strokeWidth={2} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0 w-[280px]">
            <Command>
              <CommandInput placeholder="Buscar país ou código..." className="h-[30px] text-sm" />
              <CommandList className="max-h-[220px]">
                <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">
                  País não encontrado
                </CommandEmpty>
                <CommandGroup>
                  {PHONE_COUNTRIES.map(c => (
                    <CommandItem
                      key={c.code}
                      value={`${c.name} ${c.dialCode} ${c.code}`}
                      onSelect={() => selectCountry(c)}
                      className="flex items-center gap-2.5 cursor-pointer py-2"
                    >
                      <span className="text-base shrink-0">{c.flag}</span>
                      <span className="flex-1 text-sm">{c.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">+{c.dialCode}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Dial code prefix */}
        <span className="pl-2 pr-1 text-sm text-muted-foreground/70 shrink-0 select-none tabular-nums">
          +{country.dialCode}
        </span>

        {/* Number input — plain input for full style control */}
        <input
          ref={inputRef}
          type="tel"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(
            "flex-1 min-w-0 h-full bg-transparent text-sm outline-none",
            "px-1 pr-3",
            "placeholder:text-muted-foreground/40",
            disabled && "cursor-not-allowed",
          )}
        />
      </div>

      {showError && (
        <p className="text-[11px] text-destructive">{error}</p>
      )}
    </div>
  );
};

export default WhatsAppInput;
