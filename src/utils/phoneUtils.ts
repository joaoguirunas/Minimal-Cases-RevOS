/**
 * Utilitários para formatação e validação de telefone/WhatsApp
 * Padrão: +55 (DDD) 9XXXXXXXX
 * Banco: 55DDDXXXXXXXXX (apenas números)
 * International: E.164 digits without + (e.g. 15555551234 for US)
 */

// ─── International phone countries ────────────────────────────────────────────

export interface PhoneCountry {
  code: string;       // ISO 2-letter
  name: string;
  dialCode: string;   // without +
  flag: string;
  placeholder: string; // national number placeholder (for display)
  maxDigits: number;   // max digits for national number (excl. dial code; for BR: DDD(2)+9 = 11)
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'BR', name: 'Brasil',          dialCode: '55',  flag: '🇧🇷', placeholder: '9 9999-9999', maxDigits: 11 },
  { code: 'AR', name: 'Argentina',       dialCode: '54',  flag: '🇦🇷', placeholder: '11 1234-5678', maxDigits: 10 },
  { code: 'US', name: 'Estados Unidos',  dialCode: '1',   flag: '🇺🇸', placeholder: '555 555-1234', maxDigits: 10 },
  { code: 'PT', name: 'Portugal',        dialCode: '351', flag: '🇵🇹', placeholder: '912 345 678',  maxDigits: 9  },
  { code: 'MX', name: 'México',          dialCode: '52',  flag: '🇲🇽', placeholder: '55 1234 5678', maxDigits: 10 },
  { code: 'CO', name: 'Colômbia',        dialCode: '57',  flag: '🇨🇴', placeholder: '300 123 4567', maxDigits: 10 },
  { code: 'CL', name: 'Chile',           dialCode: '56',  flag: '🇨🇱', placeholder: '9 1234 5678',  maxDigits: 9  },
  { code: 'PE', name: 'Peru',            dialCode: '51',  flag: '🇵🇪', placeholder: '912 345 678',  maxDigits: 9  },
  { code: 'UY', name: 'Uruguai',         dialCode: '598', flag: '🇺🇾', placeholder: '94 123 456',   maxDigits: 8  },
  { code: 'PY', name: 'Paraguai',        dialCode: '595', flag: '🇵🇾', placeholder: '961 123 456',  maxDigits: 9  },
  { code: 'ES', name: 'Espanha',         dialCode: '34',  flag: '🇪🇸', placeholder: '612 345 678',  maxDigits: 9  },
  { code: 'GB', name: 'Reino Unido',     dialCode: '44',  flag: '🇬🇧', placeholder: '7400 123456',  maxDigits: 10 },
  { code: 'DE', name: 'Alemanha',        dialCode: '49',  flag: '🇩🇪', placeholder: '151 12345678', maxDigits: 11 },
  { code: 'FR', name: 'França',          dialCode: '33',  flag: '🇫🇷', placeholder: '6 12 34 56 78', maxDigits: 9 },
  { code: 'IT', name: 'Itália',          dialCode: '39',  flag: '🇮🇹', placeholder: '312 345 6789', maxDigits: 10 },
  { code: 'CA', name: 'Canadá',          dialCode: '1',   flag: '🇨🇦', placeholder: '604 555-1234', maxDigits: 10 },
  { code: 'AU', name: 'Austrália',       dialCode: '61',  flag: '🇦🇺', placeholder: '412 345 678',  maxDigits: 9  },
  { code: 'JP', name: 'Japão',           dialCode: '81',  flag: '🇯🇵', placeholder: '80 1234 5678', maxDigits: 10 },
  { code: 'CN', name: 'China',           dialCode: '86',  flag: '🇨🇳', placeholder: '131 2345 6789', maxDigits: 11 },
  { code: 'IN', name: 'Índia',           dialCode: '91',  flag: '🇮🇳', placeholder: '98765 43210',  maxDigits: 10 },
];

/** Detect country from stored E.164 digits (no +). Tries longer dial codes first to avoid prefix collisions. */
export const detectCountryFromPhone = (digits: string): PhoneCountry | null => {
  if (!digits) return null;
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  for (const country of sorted) {
    if (digits.startsWith(country.dialCode)) return country;
  }
  return null;
};

// Remove todos os caracteres não numéricos
export const sanitizePhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

// Formata número para exibição: +55 (48) 991898486
export const formatPhoneDisplay = (phone: string): string => {
  const numbers = sanitizePhone(phone);
  
  if (!numbers) return '';
  
  // Se já tem o 55, formata completo
  if (numbers.startsWith('55') && numbers.length >= 12) {
    const ddd = numbers.slice(2, 4);
    const numero = numbers.slice(4);
    return `+55 (${ddd}) ${numero}`;
  }
  
  // Se tem 11 dígitos (DDD + 9 dígitos), adiciona o 55
  if (numbers.length === 11) {
    const ddd = numbers.slice(0, 2);
    const numero = numbers.slice(2);
    return `+55 (${ddd}) ${numero}`;
  }
  
  // Se tem 10 dígitos (DDD + 8 dígitos - formato antigo), adiciona 55 e o 9
  if (numbers.length === 10) {
    const ddd = numbers.slice(0, 2);
    const numero = numbers.slice(2);
    return `+55 (${ddd}) 9${numero}`;
  }
  
  // Retorna como está se não se encaixa nos padrões
  return phone;
};

// Formata para salvar no banco: 5548991898486
export const formatPhoneForDatabase = (phone: string): string => {
  const numbers = sanitizePhone(phone);
  
  if (!numbers) return '';
  
  // Se já começa com 55 e tem tamanho correto
  if (numbers.startsWith('55') && numbers.length === 13) {
    return numbers;
  }
  
  // Se tem 11 dígitos (DDD + 9 dígitos), adiciona o 55
  if (numbers.length === 11) {
    return `55${numbers}`;
  }
  
  // Se tem 10 dígitos (DDD + 8 dígitos - formato antigo), adiciona 55 e o 9
  if (numbers.length === 10) {
    const ddd = numbers.slice(0, 2);
    const numero = numbers.slice(2);
    return `55${ddd}9${numero}`;
  }
  
  // Se tem 9 dígitos (só o número sem DDD), retorna como está para validação falhar
  if (numbers.length === 9) {
    return numbers;
  }
  
  return numbers;
};

// Valida se o número está no formato correto
export const validatePhone = (phone: string): { valid: boolean; error?: string } => {
  const numbers = sanitizePhone(phone);
  
  if (!numbers) {
    return { valid: false, error: 'WhatsApp é obrigatório' };
  }
  
  // Verifica se tem apenas números
  if (!/^\d+$/.test(numbers)) {
    return { valid: false, error: 'Apenas números são permitidos' };
  }
  
  // Formato esperado: 13 dígitos (55 + DDD + 9 dígitos)
  // Ou 11 dígitos (DDD + 9 dígitos) que será convertido
  // Ou 10 dígitos (DDD + 8 dígitos) que será convertido
  
  if (numbers.startsWith('55')) {
    if (numbers.length !== 13) {
      return { valid: false, error: 'Formato inválido. Use: +55 (DDD) 9XXXXXXXX' };
    }
    const ddd = numbers.slice(2, 4);
    const telefone = numbers.slice(4);
    
    if (!telefone.startsWith('9')) {
      return { valid: false, error: 'Número de celular deve começar com 9' };
    }
    
    if (telefone.length !== 9) {
      return { valid: false, error: 'Número deve ter 9 dígitos após o DDD' };
    }
    
    const dddNum = parseInt(ddd);
    if (dddNum < 11 || dddNum > 99) {
      return { valid: false, error: 'DDD inválido' };
    }
  } else if (numbers.length === 11) {
    const ddd = numbers.slice(0, 2);
    const telefone = numbers.slice(2);
    
    if (!telefone.startsWith('9')) {
      return { valid: false, error: 'Número de celular deve começar com 9' };
    }
    
    const dddNum = parseInt(ddd);
    if (dddNum < 11 || dddNum > 99) {
      return { valid: false, error: 'DDD inválido' };
    }
  } else if (numbers.length === 10) {
    // Formato antigo: DDD + 8 dígitos (será adicionado o 9)
    const ddd = numbers.slice(0, 2);
    const dddNum = parseInt(ddd);
    if (dddNum < 11 || dddNum > 99) {
      return { valid: false, error: 'DDD inválido' };
    }
  } else {
    return { valid: false, error: 'Formato inválido. Use: +55 (DDD) 9XXXXXXXX' };
  }
  
  return { valid: true };
};

// Formata o input enquanto o usuário digita
export const formatPhoneInput = (value: string): string => {
  const numbers = sanitizePhone(value);
  
  if (!numbers) return '';
  
  // Limita a 13 dígitos (55 + DDD + 9 dígitos)
  const limited = numbers.slice(0, 13);
  
  // Se começa com 55, formata como +55 (XX) XXXXXXXXX
  if (limited.startsWith('55')) {
    if (limited.length <= 2) return '+55';
    if (limited.length <= 4) return `+55 (${limited.slice(2)}`;
    if (limited.length <= 5) return `+55 (${limited.slice(2, 4)}) ${limited.slice(4)}`;
    return `+55 (${limited.slice(2, 4)}) ${limited.slice(4)}`;
  }
  
  // Se não começa com 55, adiciona automaticamente
  if (limited.length <= 2) return `+55 (${limited}`;
  if (limited.length <= 3) return `+55 (${limited.slice(0, 2)}) ${limited.slice(2)}`;
  return `+55 (${limited.slice(0, 2)}) ${limited.slice(2)}`;
};
