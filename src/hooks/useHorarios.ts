import { useSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule, getDiaSemanaLabel } from './useSchedules';

// Re-export real hooks from useSchedules
export { 
  useSchedules as useHorarios,
  useCreateSchedule as useCriarHorario,
  useUpdateSchedule as useUpdateHorario,
  useDeleteSchedule as useDeleteHorario,
  getDiaSemanaLabel
};

export default useSchedules;