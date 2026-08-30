import React from 'react';
import { Eye } from 'lucide-react';

interface TemplateComponent {
  type: string;
  text?: string;
  format?: string;
  buttons?: Array<{
    text: string;
    type: string;
  }>;
}

interface WhatsappTemplatePreviewProps {
  components: TemplateComponent[];
}

export const WhatsappTemplatePreview: React.FC<WhatsappTemplatePreviewProps> = ({ components }) => {
  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="border border-border rounded-[2px] overflow-hidden">
      {/* Header */}
      <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
        <Eye className="w-4 h-4 text-white" />
        <span className="text-sm font-medium text-white">Preview da Mensagem</span>
      </div>

      {/* WhatsApp Background - padrão oficial do WhatsApp */}
      <div className="relative p-6" style={{
        backgroundColor: '#0b141a',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='260' viewBox='0 0 260 260'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M24.37 16c.2.65.39 1.32.54 2H21.17l1.17-2h2.03zm-3.17 2H18l1.17-2h2.03c.2.65.39 1.32.54 2zM20 2c.2.65.39 1.32.54 2H17.7l1.17-2h1.13zm-3.17 2H13.7l1.17-2h2.03c.2.65.39 1.32.54 2zm2.03-2h2.03c.2.65.39 1.32.54 2h-3.11l1.17-2h-.63z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
      }}>
        {/* Message Bubble */}
        <div className="bg-[#D9FDD3] rounded-[7.5px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] w-full relative" style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
        }}>
          {/* Cauda da mensagem */}
          <div className="absolute -right-[8px] top-0">
            <svg viewBox="0 0 8 13" width="8" height="13" className="text-[#D9FDD3] scale-x-[-1]">
              <path opacity=".13" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" fill="currentColor"/>
              <path fill="currentColor" d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z"/>
            </svg>
          </div>
          
          <div className="px-[7px] pt-[6px] pb-[8px]">
            <div className="space-y-[3px]">
              {components.map((component, index) => {
                if (component.type === 'HEADER' && component.text) {
                  return (
                    <div key={index} className="font-semibold text-[14.2px] text-[#111B21] mb-[2px] leading-[19px]">
                      {component.text}
                    </div>
                  );
                }

                if (component.type === 'BODY' && component.text) {
                  return (
                    <div key={index} className="text-[14.2px] text-[#111B21] whitespace-pre-wrap leading-[19px] font-normal break-words">
                      {component.text}
                    </div>
                  );
                }

                if (component.type === 'FOOTER' && component.text) {
                  return (
                    <div key={index} className="text-[12px] text-[#667781] mt-[2px] leading-[16px]">
                      {component.text}
                    </div>
                  );
                }

                return null;
              })}

              {/* Time and status */}
              <div className="flex justify-end items-center gap-[3px] mt-[4px] float-right ml-[8px]">
                <span className="text-[11px] text-[#667781] leading-[15px]">{getCurrentTime()}</span>
                <svg width="16" height="11" viewBox="0 0 16 11" className="inline-block">
                  <path fill="#53BDEB" d="M11.071.653a.5.5 0 0 0-.707 0L5.5 5.518 2.636 2.653a.5.5 0 1 0-.707.707l3.218 3.218a.5.5 0 0 0 .707 0l5.217-5.218a.5.5 0 0 0 0-.707zm4.243 0a.5.5 0 0 0-.707 0L9.743 5.518 8.925 4.7a.5.5 0 1 0-.707.707l1.525 1.525a.5.5 0 0 0 .707 0l5.217-5.218a.5.5 0 0 0 0-.707z"/>
                </svg>
              </div>
              <div className="clear-both"></div>
            </div>

            {/* Buttons */}
            {components.map((component, index) => {
              if (component.type === 'BUTTONS' && component.buttons) {
                return (
                  <div key={index} className="space-y-0 pt-[8px] mt-[3px] border-t border-[rgba(0,0,0,0.05)] -mx-[7px] px-[7px]">
                    {component.buttons.map((button, btnIndex) => (
                      <div key={btnIndex}>
                        {btnIndex > 0 && <div className="border-t border-[rgba(0,0,0,0.05)]" />}
                        <button
                          className="w-full py-[9px] text-[14px] font-medium text-[#027EB5] hover:bg-black/5 transition-colors text-center"
                          disabled
                        >
                          {button.text}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
