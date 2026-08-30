import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MeetingRecord {
  id: string;
  meeting_id: string;
  record_type: 'recording' | 'transcript' | 'summary' | 'ai_summary' | 'ai_analysis' | 'note';
  source?: string;
  url?: string;
  duration_seconds?: number;
  thumbnail_url?: string;
  title?: string;
  content?: string;
  content_format?: string;
  ai_sentiment?: 'positivo' | 'neutro' | 'negativo' | 'misto';
  ai_score?: number;
  ai_key_topics?: string[];
  ai_next_steps?: string[];
  ai_objections?: string[];
  ai_metadata?: Record<string, unknown>;
  tldv_meeting_id?: string | null;
  transcript_json?: Array<{ speaker: string; text: string; startTime: number; endTime: number }> | null;
  highlights?: string[] | null;
  recorded_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMeetingRecordData {
  meeting_id: string;
  record_type: MeetingRecord['record_type'];
  source?: string;
  url?: string;
  duration_seconds?: number;
  thumbnail_url?: string;
  title?: string;
  content?: string;
  content_format?: string;
  ai_sentiment?: MeetingRecord['ai_sentiment'];
  ai_score?: number;
  ai_key_topics?: string[];
  ai_next_steps?: string[];
  ai_objections?: string[];
  recorded_at?: string;
  created_by?: string;
}

export const useMeetingRecords = (meetingId: string) =>
  useQuery({
    queryKey: ['meeting-records', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_records')
        .select('*')
        .eq('meeting_id', meetingId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as MeetingRecord[];
    },
    enabled: !!meetingId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

export const useCreateMeetingRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMeetingRecordData) => {
      const { data: record, error } = await supabase
        .from('meeting_records')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return record;
    },
    onSuccess: (record) => {
      queryClient.invalidateQueries({ queryKey: ['meeting-records', record.meeting_id] });
      toast.success('Registro adicionado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error creating meeting record:', error);
      toast.error(error.message || 'Erro ao adicionar registro');
    },
  });
};

export type UpdateMeetingRecordData = Partial<Omit<CreateMeetingRecordData, 'meeting_id'>> & { id: string; meetingId: string };

export const useUpdateMeetingRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, meetingId, ...data }: UpdateMeetingRecordData) => {
      const { data: record, error } = await supabase
        .from('meeting_records')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { record, meetingId };
    },
    onSuccess: ({ meetingId }) => {
      queryClient.invalidateQueries({ queryKey: ['meeting-records', meetingId] });
      toast.success('Registro atualizado!');
    },
    onError: (error: Error) => {
      console.error('Error updating meeting record:', error);
      toast.error(error.message || 'Erro ao atualizar registro');
    },
  });
};

export const useDeleteMeetingRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, meetingId }: { id: string; meetingId: string }) => {
      const { error } = await supabase
        .from('meeting_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, meetingId };
    },
    onSuccess: ({ meetingId }) => {
      queryClient.invalidateQueries({ queryKey: ['meeting-records', meetingId] });
      toast.success('Registro excluído!');
    },
    onError: (error: Error) => {
      console.error('Error deleting meeting record:', error);
      toast.error(error.message || 'Erro ao excluir registro');
    },
  });
};
