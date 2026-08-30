
import { useMemo } from 'react';
import { subDays, subWeeks, subMonths, subYears, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';

export interface PeriodFilter {
  dataInicio: string;
  dataFim: string;
  label: string;
}

export const usePeriodFilter = (period: string): PeriodFilter => {
  return useMemo(() => {
    const hoje = new Date();
    const inicioHoje = startOfDay(hoje);
    const fimHoje = endOfDay(hoje);
    
    let dataInicio: Date;
    let dataFim: Date = fimHoje;
    let label: string;

    switch (period) {
      case 'today':
        dataInicio = inicioHoje;
        label = 'Hoje';
        break;
      case 'week':
        dataInicio = startOfWeek(hoje, { weekStartsOn: 1 }); // Segunda-feira
        dataFim = endOfWeek(hoje, { weekStartsOn: 1 }); // Domingo
        label = 'Semana atual';
        break;
      case 'month':
        dataInicio = startOfMonth(hoje);
        dataFim = endOfMonth(hoje);
        label = 'Mês atual';
        break;
      case 'hoje':
      case '1d':
        dataInicio = inicioHoje;
        label = 'Hoje';
        break;
      case '7d':
        dataInicio = startOfDay(subDays(hoje, 6)); // Hoje + 6 dias anteriores = 7 dias no total
        label = 'Últimos 7 dias';
        break;
      case 'semana':
        dataInicio = startOfWeek(hoje, { weekStartsOn: 1 }); // Segunda-feira
        dataFim = endOfWeek(hoje, { weekStartsOn: 1 }); // Domingo
        label = 'Semana atual';
        break;
      case 'mes':
        dataInicio = startOfMonth(hoje);
        dataFim = endOfMonth(hoje);
        label = 'Mês atual';
        break;
      case '30d':
      case '30dias':
        dataInicio = startOfDay(subDays(hoje, 29)); // Hoje + 29 dias anteriores = 30 dias no total
        label = 'Últimos 30 dias';
        break;
      case '60d':
      case '60dias':
        dataInicio = startOfDay(subDays(hoje, 59));
        label = 'Últimos 60 dias';
        break;
      case '90d':
        dataInicio = startOfDay(subDays(hoje, 89));
        label = 'Últimos 90 dias';
        break;
      case '6m':
        dataInicio = startOfDay(subMonths(hoje, 6));
        label = 'Últimos 6 meses';
        break;
      case '1y':
        dataInicio = startOfDay(subYears(hoje, 1));
        label = 'Último ano';
        break;
      case 'personalizado':
        // Por enquanto, usar um período amplo para personalizado
        dataInicio = startOfDay(subYears(hoje, 2));
        label = 'Personalizado';
        break;
      default:
        dataInicio = startOfDay(subDays(hoje, 6)); // Padrão: últimos 7 dias
        label = 'Últimos 7 dias';
    }


    return {
      dataInicio: dataInicio.toISOString(),
      dataFim: dataFim.toISOString(),
      label
    };
  }, [period]);
};

export const periodOptions = [
  { value: 'all', label: 'Todo período' },
  { value: 'custom', label: 'Período personalizado' },
];
