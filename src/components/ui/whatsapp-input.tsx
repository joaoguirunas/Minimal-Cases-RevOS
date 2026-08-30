
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CountryCode {
  code: string;
  country: string;
  flag: string;
}

const countryCodes: CountryCode[] = [
  { code: '+55', country: 'Brasil', flag: '🇧🇷' },
  { code: '+1', country: 'EUA/Canadá', flag: '🇺🇸' },
  { code: '+44', country: 'Reino Unido', flag: '🇬🇧' },
  { code: '+49', country: 'Alemanha', flag: '🇩🇪' },
  { code: '+33', country: 'França', flag: '🇫🇷' },
  { code: '+39', country: 'Itália', flag: '🇮🇹' },
  { code: '+34', country: 'Espanha', flag: '🇪🇸' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
];

interface WhatsAppInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

const WhatsAppInput: React.FC<WhatsAppInputProps> = ({
  value,
  onChange,
  placeholder = "11999990000",
  disabled = false,
  id
}) => {
  const [selectedCountry, setSelectedCountry] = useState('+55');
  
  // Extrair código do país e número do valor atual
  const parseValue = (val: string) => {
    if (!val) return { countryCode: '+55', number: '' };
    
    const foundCountry = countryCodes.find(country => val.startsWith(country.code));
    if (foundCountry) {
      return {
        countryCode: foundCountry.code,
        number: val.slice(foundCountry.code.length).trim()
      };
    }
    
    return { countryCode: '+55', number: val };
  };

  const { countryCode, number } = parseValue(value);
  
  // Atualizar selectedCountry quando o valor mudar externamente
  React.useEffect(() => {
    setSelectedCountry(countryCode);
  }, [countryCode]);

  const formatNumber = (input: string, code: string) => {
    // Remove tudo que não é número
    const numbers = input.replace(/\D/g, '');
    
    if (code === '+55') {
      // Formato brasileiro: 11999990000
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 7) return `${numbers.slice(0, 2)}${numbers.slice(2)}`;
      return `${numbers.slice(0, 2)}${numbers.slice(2, 7)}${numbers.slice(7, 11)}`;
    } else if (code === '+1') {
      // Formato americano: 5551234567
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `${numbers.slice(0, 3)}${numbers.slice(3)}`;
      return `${numbers.slice(0, 3)}${numbers.slice(3, 6)}${numbers.slice(6, 10)}`;
    } else {
      // Formato genérico para outros países
      return numbers.slice(0, 15);
    }
  };

  const handleCountryChange = (newCountry: string) => {
    setSelectedCountry(newCountry);
    const formattedNumber = formatNumber(number, newCountry);
    onChange(`${newCountry} ${formattedNumber}`);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formattedNumber = formatNumber(inputValue, selectedCountry);
    onChange(`${selectedCountry} ${formattedNumber}`);
  };

  return (
    <div className="flex gap-2">
      <Select value={selectedCountry} onValueChange={handleCountryChange} disabled={disabled}>
        <SelectTrigger className="w-32">
          <SelectValue>
            <div className="flex items-center gap-2">
              <span>{countryCodes.find(c => c.code === selectedCountry)?.flag}</span>
              <span>{selectedCountry}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {countryCodes.map((country) => (
            <SelectItem key={country.code} value={country.code}>
              <div className="flex items-center gap-2">
                <span>{country.flag}</span>
                <span>{country.code}</span>
                <span className="text-muted-foreground">({country.country})</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Input
        id={id}
        type="tel"
        value={number}
        onChange={handleNumberChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  );
};

export default WhatsAppInput;
