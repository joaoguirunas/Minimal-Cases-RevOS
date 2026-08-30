
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

export const useProfile = () => {
  const { user, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const updateProfile = async (data: {
    nome: string;
    email: string;
    whatsapp?: string;
    agente?: string | null;
  }) => {
    if (!user?.profile?.id) {
      toast.error('Usuário não encontrado');
      return { error: 'Usuário não encontrado' };
    }

    setIsLoading(true);
    
    try {
      // Atualizar dados no CRM
      const { error: updateError } = await supabase
        .from('settings_users')
        .update({
          name: data.nome,
          email: data.email,
          phone: data.whatsapp || null,
          ...(data.agente !== undefined ? { agente: data.agente || null } : {}),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.profile.id);

      if (updateError) {
        console.error('Erro ao atualizar perfil:', updateError);
        toast.error('Erro ao atualizar perfil');
        return { error: updateError.message };
      }

      // Atualizar email no auth se foi alterado
      if (data.email !== user.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: data.email
        });

        if (authError) {
          console.error('Erro ao atualizar email:', authError);
          toast.error('Perfil atualizado, mas houve erro ao alterar email. Verifique sua caixa de entrada.');
        } else {
          toast.success('Perfil atualizado! Verifique seu email para confirmar a alteração.');
        }
      } else {
        toast.success('Perfil atualizado com sucesso!');
      }

      // Refresh profile data
      await refreshProfile();
      
      return {};
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      toast.error('Erro interno do servidor');
      return { error: 'Erro interno do servidor' };
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('As senhas não coincidem');
      return { error: 'As senhas não coincidem' };
    }

    if (data.newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return { error: 'A nova senha deve ter pelo menos 6 caracteres' };
    }

    setIsLoading(true);

    try {
      // Verificar senha atual fazendo login
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: data.currentPassword
      });

      if (signInError) {
        toast.error('Senha atual incorreta');
        return { error: 'Senha atual incorreta' };
      }

      // Atualizar senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.newPassword
      });

      if (updateError) {
        console.error('Erro ao atualizar senha:', updateError);
        toast.error('Erro ao atualizar senha');
        return { error: updateError.message };
      }

      toast.success('Senha alterada com sucesso!');
      return {};
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      toast.error('Erro interno do servidor');
      return { error: 'Erro interno do servidor' };
    } finally {
      setIsLoading(false);
    }
  };

  const updateTheme = async (newTheme: 'light' | 'dark') => {
    if (!user?.profile?.id) {
      toast.error('Usuário não encontrado');
      return { error: 'Usuário não encontrado' };
    }

    setIsLoading(true);
    
    try {
      const { error: updateError } = await supabase
        .from('settings_users')
        .update({
          theme: newTheme,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.profile.id);

      if (updateError) {
        console.error('Erro ao atualizar tema:', updateError);
        toast.error('Erro ao atualizar tema');
        return { error: updateError.message };
      }

      setTheme(newTheme);
      toast.success('Tema atualizado com sucesso!');
      await refreshProfile();
      
      return {};
    } catch (error) {
      console.error('Erro ao atualizar tema:', error);
      toast.error('Erro interno do servidor');
      return { error: 'Erro interno do servidor' };
    } finally {
      setIsLoading(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user?.id || !user?.profile?.id) {
      toast.error('Usuário não encontrado');
      return { error: 'Usuário não encontrado' };
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida');
      return { error: 'Arquivo inválido' };
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return { error: 'Arquivo muito grande' };
    }

    setIsUploadingAvatar(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error('Erro ao fazer upload:', uploadError);
        toast.error('Erro ao fazer upload da imagem');
        return { error: uploadError.message };
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(fileName);

      // Update user profile with avatar URL
      const { error: updateError } = await supabase
        .from('settings_users')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.profile.id);

      if (updateError) {
        console.error('Erro ao atualizar perfil:', updateError);
        toast.error('Erro ao atualizar foto de perfil');
        return { error: updateError.message };
      }

      toast.success('Foto de perfil atualizada!');
      await refreshProfile();
      
      return { url: publicUrl };
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro interno do servidor');
      return { error: 'Erro interno do servidor' };
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    if (!user?.profile?.id) {
      toast.error('Usuário não encontrado');
      return { error: 'Usuário não encontrado' };
    }

    setIsUploadingAvatar(true);

    try {
      // Update user profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('settings_users')
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.profile.id);

      if (updateError) {
        console.error('Erro ao remover foto:', updateError);
        toast.error('Erro ao remover foto de perfil');
        return { error: updateError.message };
      }

      toast.success('Foto de perfil removida!');
      await refreshProfile();
      
      return {};
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      toast.error('Erro interno do servidor');
      return { error: 'Erro interno do servidor' };
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  return {
    user,
    theme,
    isLoading,
    isUploadingAvatar,
    updateProfile,
    updatePassword,
    updateTheme,
    uploadAvatar,
    removeAvatar
  };
};
