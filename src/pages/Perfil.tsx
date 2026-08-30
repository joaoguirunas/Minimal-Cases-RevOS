import { useState, useEffect, useRef } from "react";
import { Save, Eye, EyeOff, Camera, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/useProfile";
import { MfaSection } from "@/components/profile/MfaSection";
import { useForm } from "react-hook-form";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { CalendarSyncCard } from "@/components/profile/CalendarSyncCard";
interface ProfileFormData {
  nome: string;
  email: string;
  whatsapp: string;
  agente: string;
}
interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
const Perfil = () => {
  const {
    user,
    theme,
    isLoading,
    isUploadingAvatar,
    updateProfile,
    updatePassword,
    updateTheme,
    uploadAvatar,
    removeAvatar
  } = useProfile();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAvatar(file);
    }
    // Reset input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    setValue: setProfileValue,
    formState: {
      errors: profileErrors
    }
  } = useForm<ProfileFormData>();
  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPasswordForm,
    formState: {
      errors: passwordErrors
    }
  } = useForm<PasswordFormData>();

  // Fill form with user data
  useEffect(() => {
    if (user?.profile) {
      setProfileValue('nome', user.profile.nome || '');
      setProfileValue('email', user.profile.email || '');
      setProfileValue('whatsapp', user.profile.whatsapp || '');
      setProfileValue('agente', user.profile.agente || '');
    }
  }, [user, setProfileValue]);
  const onSubmitProfile = async (data: ProfileFormData) => {
    setIsUpdatingProfile(true);
    try {
      await updateProfile({
        ...data,
        agente: user?.profile?.user_type === 'user' ? (data.agente || null) : undefined,
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };
  const onSubmitPassword = async (data: PasswordFormData) => {
    setIsUpdatingPassword(true);
    try {
      const result = await updatePassword(data);
      if (!result.error) {
        resetPasswordForm();
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };
  const getInitials = (name: string) => {
    return name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().slice(0, 2);
  };
  if (!user) {
    return <div className="space-y-6 max-w-2xl">
        <div className="text-center">
          <p className="text-muted-foreground">Carregando perfil...</p>
        </div>
      </div>;
  }
  return <div className="space-y-6 max-w-6xl mx-auto px-4 md:px-8 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[18px] font-['Outfit'] font-bold text-foreground">Meu Perfil</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Coluna esquerda: conta */}
        <div className="space-y-6">

      {/* Personal Information */}
      <Card className="p-6 rounded-[2px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-semibold">Informações Pessoais</h3>
          <div className="flex items-center gap-4">
            {/* Avatar with upload */}
            <div className="relative group">
              <Avatar className="w-20 h-20 cursor-pointer" onClick={handleAvatarClick}>
                <AvatarImage src={user.profile?.avatar_url || undefined} alt={user.profile?.nome} />
                <AvatarFallback className="bg-iatize-blue text-white text-xl">
                  {getInitials(user.profile?.nome || user.email || 'U')}
                </AvatarFallback>
              </Avatar>
              
              {/* Overlay on hover */}
              <div 
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={handleAvatarClick}
              >
                {isUploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
              
              {/* Remove button if has avatar */}
              {user.profile?.avatar_url && !isUploadingAvatar && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAvatar();
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
              
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          Clique na foto para alterar
        </p>
        
        <form onSubmit={handleSubmitProfile(onSubmitProfile)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="nome" className="pl-1 ">Nome Completo</Label>
              <Input id="nome" {...registerProfile('nome', {
              required: 'Nome é obrigatório',
              minLength: {
                value: 2,
                message: 'Nome deve ter pelo menos 2 caracteres'
              }
            })} disabled={isLoading} />
              {profileErrors.nome && <p className="text-sm text-destructive mt-1">{profileErrors.nome.message}</p>}
            </div>
            <div>
              <Label htmlFor="email" className="pl-1">Email</Label>
              <Input id="email" type="email" {...registerProfile('email', {
              required: 'Email é obrigatório',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Email inválido'
              }
            })} disabled={isLoading} />
              {profileErrors.email && <p className="text-sm text-destructive mt-1">{profileErrors.email.message}</p>}
            </div>
          </div>
          
          <div>
            <Label htmlFor="whatsapp" className="pl-1">WhatsApp</Label>
            <Input id="whatsapp" placeholder="+55 11 99999-0000" {...registerProfile('whatsapp')} disabled={isLoading} />
          </div>

          {user.profile?.user_type === 'user' && (
            <div>
              <Label htmlFor="agente" className="pl-1">Agente</Label>
              <Input id="agente" placeholder="Nome do agente" {...registerProfile('agente')} disabled={isLoading} />
            </div>
          )}

          <div>
            <Label className="pl-1">Função</Label>
            <Input
              value={user.profile?.user_type === 'admin' ? 'Admin' : user.profile?.user_type === 'manager' ? 'Manager' : 'User'}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="pt-4">
            <Button type="submit" className="h-[30px] rounded-[4px] text-xs" disabled={isUpdatingProfile || isLoading}>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {isUpdatingProfile ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Security */}
      <Card className="p-6 rounded-[2px]">
        <h3 className="text-[14px] font-semibold mb-4">Segurança</h3>
        <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword" className="pl-1">Senha Atual</Label>
            <div className="relative">
              <Input id="currentPassword" type={showPassword ? "text" : "password"} placeholder="Digite sua senha atual" {...registerPassword('currentPassword', {
              required: 'Senha atual é obrigatória'
            })} disabled={isLoading} />
              <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 transform -translate-y-1/2" onClick={() => setShowPassword(!showPassword)} disabled={isLoading}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            {passwordErrors.currentPassword && <p className="text-sm text-destructive mt-1">{passwordErrors.currentPassword.message}</p>}
          </div>

          <div>
            <Label htmlFor="newPassword" className="pl-1">Nova Senha</Label>
            <Input id="newPassword" type={showPassword ? "text" : "password"} placeholder="Digite sua nova senha" {...registerPassword('newPassword', {
            required: 'Nova senha é obrigatória',
            minLength: {
              value: 6,
              message: 'Senha deve ter pelo menos 6 caracteres'
            }
          })} disabled={isLoading} />
            {passwordErrors.newPassword && <p className="text-sm text-destructive mt-1">{passwordErrors.newPassword.message}</p>}
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="pl-1">Confirmar Nova Senha</Label>
            <Input id="confirmPassword" type={showPassword ? "text" : "password"} placeholder="Confirme sua nova senha" {...registerPassword('confirmPassword', {
            required: 'Confirmação de senha é obrigatória'
          })} disabled={isLoading} />
            {passwordErrors.confirmPassword && <p className="text-sm text-destructive mt-1">{passwordErrors.confirmPassword.message}</p>}
          </div>

          <div className="pt-4">
            <Button type="submit" variant="outline" className="h-[30px] rounded-[4px] text-xs" disabled={isUpdatingPassword || isLoading}>
              {isUpdatingPassword ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </div>
        </form>
      </Card>

      {/* Preferences */}
      <Card className="p-6 rounded-[2px]">
        <h3 className="text-[14px] font-semibold mb-4">Preferências</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="language" className="pl-1">Idioma</Label>
              <Select
                value={settings?.language || "pt-br"}
                onValueChange={(value) => updateSettings.mutate({ language: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-br">Português (BR)</SelectItem>
                  <SelectItem value="en-us">English (US)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pl-10">
              <Label className="pl-1">Tema Escuro</Label>
              <div className="flex items-center h-10">
                <Switch checked={theme === 'dark'} onCheckedChange={checked => updateTheme(checked ? 'dark' : 'light')} disabled={isLoading} />
              </div>
            </div>
          </div>

          <div className="pt-2">

          </div>
        </div>
      </Card>

        </div>

        {/* Coluna direita: integrações */}
        <div className="space-y-4">
          <div className="pb-2 border-b border-border">
            <h2 className="text-[14px] font-semibold text-foreground">Integrações</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Segurança da conta e conexões com serviços externos.
            </p>
          </div>

          {/* MFA */}
          <MfaSection />

          {/* Calendário & Videoconferência */}
          <CalendarSyncCard />
        </div>
      </div>
    </div>;
};
export default Perfil;