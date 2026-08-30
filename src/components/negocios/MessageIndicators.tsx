
import { MessageSquare, Bot, User, UserCheck } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface MessageIndicatorsProps {
  totalMessages: number;
  agentIAMessages: number;
  humanMessages: number;
  clientMessages: number;
}

const MessageIndicators = ({ 
  totalMessages, 
  agentIAMessages, 
  humanMessages, 
  clientMessages 
}: MessageIndicatorsProps) => {
  return (
    <div className="flex items-center gap-1 text-xs">
      <Badge variant="outline" className="px-1 py-0 h-5 text-xs bg-[#3B82F6]/10 border-[#3B82F6]/20 rounded-[2px]">
        <MessageSquare className="w-2.5 h-2.5 text-[#3B82F6] mr-1" />
        <span className="text-[#3B82F6] font-medium">{totalMessages}</span>
      </Badge>

      <Badge variant="outline" className="px-1 py-0 h-5 text-xs bg-[#00D26A]/10 border-[#00D26A]/20 rounded-[2px]">
        <Bot className="w-2.5 h-2.5 text-[#00D26A] mr-1" />
        <span className="text-[#00D26A] font-medium">{agentIAMessages}</span>
      </Badge>

      <Badge variant="outline" className="px-1 py-0 h-5 text-xs bg-[#F59E0B]/10 border-[#F59E0B]/20 rounded-[2px]">
        <UserCheck className="w-2.5 h-2.5 text-[#F59E0B] mr-1" />
        <span className="text-[#F59E0B] font-medium">{humanMessages}</span>
      </Badge>

      <Badge variant="outline" className="px-1 py-0 h-5 text-xs bg-[#8B5CF6]/10 border-[#8B5CF6]/20 rounded-[2px]">
        <User className="w-2.5 h-2.5 text-[#8B5CF6] mr-1" />
        <span className="text-[#8B5CF6] font-medium">{clientMessages}</span>
      </Badge>
    </div>
  );
};

export default MessageIndicators;
