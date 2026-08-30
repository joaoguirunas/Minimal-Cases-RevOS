import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface DashboardAgendamentosData {
  // General metrics
  totalMeetings: number;
  totalManualBlocks: number;
  meetingsAttended: number;
  meetingsNotAttended: number;
  attendanceRate: number;
  
  // Leads vs meetings metrics
  totalLeads: number;
  percentageLeadsWithMeetings: number;
  
  // Rankings
  salesRepRankingScheduled: Array<{
    salesRep: string;
    salesRepId: string;
    scheduledMeetings: number;
    meetingsAttended: number;
    attendanceRate: number;
  }>;
  
  // Manual blocks by sales rep
  blocksBySalesRep: Array<{
    salesRep: string;
    salesRepId: string;
    totalBlocks: number;
    blocks: Array<{
      date: string;
      startTime: string;
      endTime: string;
      notes?: string;
    }>;
  }>;
  
  // Chart data
  meetingStatuses: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;

  appointmentsEvolution: Array<{
    date: string;
    meetings: number;
    totalLeads: number;
    scheduled: number;
    attended: number;
    notAttended: number;
    canceled: number;
    total: number;
  }>;
}

export interface DashboardAgendamentosFilters {
  dateRange?: {
    from: Date | undefined;
    to: Date | undefined;
  };
  salesRep?: string;
  scores?: number[];
}

export const useDashboardAgendamentos = (
  period: string = 'all',
  filters: DashboardAgendamentosFilters = {}
) => {
  return useQuery({
    queryKey: ['dashboard-appointments', period, filters],
    queryFn: async (): Promise<DashboardAgendamentosData> => {
      // Get current user profile to check permissions
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: profile } = await supabase
        .from('settings_users')
        .select('id, gestor')
        .eq('auth_user_id', user.id)
        .single();

      // Calculate dates based on period
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (period === 'custom' && filters.dateRange?.from && filters.dateRange?.to) {
        startDate = new Date(filters.dateRange.from);
        endDate = new Date(filters.dateRange.to);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      }

      console.log('🔍 Dashboard Appointments - Applied filters:', {
        period,
        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : 'all',
        endDate: endDate ? format(endDate, 'yyyy-MM-dd') : 'all',
        salesRep: filters.salesRep,
        scores: filters.scores
      });

      // Build meetings query with joins
      let meetingsQuery = supabase
        .from('meetings')
        .select(`
          *,
          lead:leads!meetings_leads_id_fkey(
            id,
            people_id,
            user_id,
            person:clients_people!leads_people_id_fkey(
              id,
              name
            )
          )
        `);

      // Apply date filter if specified
      if (startDate && endDate) {
        meetingsQuery = meetingsQuery
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'));
      }

      // Apply permissions: regular users see only their meetings, managers see all
      if (!profile?.gestor && profile?.id) {
        meetingsQuery = meetingsQuery.eq('user_id', profile.id);
      }

      // Apply sales rep filter if specified
      if (filters.salesRep) {
        meetingsQuery = meetingsQuery.eq('user_id', filters.salesRep);
      }

      const { data: meetings, error: meetingsError } = await meetingsQuery;

      if (meetingsError) {
        console.error('Error fetching meetings:', meetingsError);
        throw meetingsError;
      }

      // Filter by score if specified - DEPRECATED: score field removed
      const filteredMeetings = meetings || [];
      // Score filter removed as the field no longer exists

      // Calculate metrics
      const totalMeetings = filteredMeetings.length;
      const meetingsAttended = filteredMeetings.filter(m => m.status === 'compareceu').length;
      const meetingsNotAttended = filteredMeetings.filter(m => m.status === 'nao_compareceu').length;
      const meetingsCanceled = filteredMeetings.filter(m => m.status === 'cancelado').length;
      const meetingsScheduled = filteredMeetings.filter(m => m.status === 'agendado').length;
      
      const attendanceRate = totalMeetings > 0 
        ? (meetingsAttended / totalMeetings) * 100 
        : 0;

      // Get unique leads
      const uniqueLeadIds = new Set(filteredMeetings.map(m => m.lead_id));
      const totalLeads = uniqueLeadIds.size;
      const percentageLeadsWithMeetings = totalLeads > 0 
        ? (totalMeetings / totalLeads) * 100 
        : 0;

      // Status breakdown
      const meetingStatuses = [
        { status: 'scheduled', count: meetingsScheduled, percentage: totalMeetings > 0 ? (meetingsScheduled / totalMeetings) * 100 : 0 },
        { status: 'attended', count: meetingsAttended, percentage: totalMeetings > 0 ? (meetingsAttended / totalMeetings) * 100 : 0 },
        { status: 'not_attended', count: meetingsNotAttended, percentage: totalMeetings > 0 ? (meetingsNotAttended / totalMeetings) * 100 : 0 },
        { status: 'canceled', count: meetingsCanceled, percentage: totalMeetings > 0 ? (meetingsCanceled / totalMeetings) * 100 : 0 }
      ];

      // Get user names for sales rep ranking
      const userIds = [...new Set(filteredMeetings.map(m => m.user_id).filter(Boolean))];
      const { data: users } = await supabase
        .from('settings_users')
        .select('id, nome')
        .in('id', userIds);
      
      const userMap = new Map(users?.map(u => [u.id, (u as { id: string; nome?: string | null }).nome]) || []);

      // Sales rep ranking
      const salesRepMap = new Map<string, { salesRep: string, salesRepId: string, scheduledMeetings: number, meetingsAttended: number }>();
      
      filteredMeetings.forEach(meeting => {
        if (meeting.user_id) {
          const key = meeting.user_id;
          if (!salesRepMap.has(key)) {
            salesRepMap.set(key, {
              salesRep: userMap.get(meeting.user_id) || 'Unknown',
              salesRepId: meeting.user_id,
              scheduledMeetings: 0,
              meetingsAttended: 0
            });
          }
          const rep = salesRepMap.get(key)!;
          rep.scheduledMeetings++;
          if (meeting.status === 'compareceu') {
            rep.meetingsAttended++;
          }
        }
      });

      const salesRepRankingScheduled = Array.from(salesRepMap.values())
        .map(rep => ({
          ...rep,
          attendanceRate: rep.scheduledMeetings > 0 
            ? (rep.meetingsAttended / rep.scheduledMeetings) * 100 
            : 0
        }))
        .sort((a, b) => b.scheduledMeetings - a.scheduledMeetings);

      // Appointments evolution by date
      const dateMap = new Map<string, { scheduled: number, attended: number, notAttended: number, canceled: number }>();
      
      filteredMeetings.forEach(meeting => {
        const dateKey = meeting.date;
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, { scheduled: 0, attended: 0, notAttended: 0, canceled: 0 });
        }
        const dayData = dateMap.get(dateKey)!;
        
        if (meeting.status === 'agendado') dayData.scheduled++;
        else if (meeting.status === 'compareceu') dayData.attended++;
        else if (meeting.status === 'nao_compareceu') dayData.notAttended++;
        else if (meeting.status === 'cancelado') dayData.canceled++;
      });

      const appointmentsEvolution = Array.from(dateMap.entries())
        .map(([date, data]) => ({
          date,
          meetings: data.scheduled + data.attended + data.notAttended + data.canceled,
          totalLeads: 0, // Can be calculated if needed
          scheduled: data.scheduled,
          attended: data.attended,
          notAttended: data.notAttended,
          canceled: data.canceled,
          total: data.scheduled + data.attended + data.notAttended + data.canceled
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalMeetings,
        totalManualBlocks: 0, // Not implemented yet
        meetingsAttended,
        meetingsNotAttended,
        attendanceRate,
        totalLeads,
        percentageLeadsWithMeetings,
        salesRepRankingScheduled,
        blocksBySalesRep: [], // Not implemented yet
        meetingStatuses,
        appointmentsEvolution
      };
    },
    staleTime: 1 * 60 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: 1
  });
};