import type { AgenteIA, PassoAgente } from '@/hooks/useAgentesIA';
import { supabase } from '@/integrations/supabase/client';

export interface ChangelogData {
  resumo: string;
  areas_alteradas: string[];
  detalhes: {
    [key: string]: {
      tipo: 'modificado' | 'adicionado' | 'removido';
      resumo: string;
      detalhes?: string[];
    };
  };
  timestamp: string;
}

export interface DetectedChanges {
  hasChanges: boolean;
  areas: {
    configuracao: boolean;
    identidade: boolean;
    regras_gerais: boolean;
    passos: boolean;
  };
  details: {
    configuracao?: { old: string; new: string }[];
    identidade?: { old: string; new: string };
    regras_gerais?: { old: string; new: string };
    passos?: {
      added: PassoAgente[];
      removed: PassoAgente[];
      modified: { old: PassoAgente; new: PassoAgente }[];
    };
  };
}

export const detectChanges = (
  original: AgenteIA,
  updated: Partial<AgenteIA>,
  originalPassos: PassoAgente[] = [],
  updatedPassos: PassoAgente[] = []
): DetectedChanges => {
  const changes: DetectedChanges = {
    hasChanges: false,
    areas: {
      configuracao: false,
      identidade: false,
      regras_gerais: false,
      passos: false,
    },
    details: {}
  };

  // Verificar mudanças na configuração básica (nome, descrição, status, usa_etapas)
  const configChanges: { old: string; new: string }[] = [];
  
  if (original.nome !== updated.nome && updated.nome !== undefined) {
    configChanges.push({ old: `Nome: ${original.nome}`, new: `Nome: ${updated.nome}` });
  }
  
  if (original.descricao !== updated.descricao && updated.descricao !== undefined) {
    configChanges.push({ 
      old: `Descrição: ${original.descricao || 'Não definida'}`, 
      new: `Descrição: ${updated.descricao || 'Não definida'}` 
    });
  }
  
  if (original.ativo !== updated.ativo && updated.ativo !== undefined) {
    configChanges.push({ 
      old: `Status: ${original.ativo ? 'Ativo' : 'Inativo'}`, 
      new: `Status: ${updated.ativo ? 'Ativo' : 'Inativo'}` 
    });
  }
  
  if (original.usa_etapas !== updated.usa_etapas && updated.usa_etapas !== undefined) {
    configChanges.push({ 
      old: `Tipo: ${original.usa_etapas ? 'Passos' : 'Único'}`, 
      new: `Tipo: ${updated.usa_etapas ? 'Passos' : 'Único'}` 
    });
  }

  if (configChanges.length > 0) {
    changes.areas.configuracao = true;
    changes.details.configuracao = configChanges;
    changes.hasChanges = true;
  }

  // Verificar mudanças nos campos de texto
  const checkTextChange = (field: keyof AgenteIA, area: keyof typeof changes.areas) => {
    const originalValue = original[field] as string || '';
    const updatedValue = updated[field] as string || '';
    
    if (originalValue.trim() !== updatedValue.trim()) {
      changes.areas[area] = true;
      changes.details[area as string] = { old: originalValue, new: updatedValue };
      changes.hasChanges = true;
    }
  };

  checkTextChange('identidade', 'identidade');
  checkTextChange('regras_gerais', 'regras_gerais');

  // Verificar mudanças nos passos (apenas se usa_etapas está ativo)
  if (updated.usa_etapas || original.usa_etapas) {
    const passosChanges = detectPassosChanges(originalPassos, updatedPassos);
    
    if (passosChanges.added.length > 0 || passosChanges.removed.length > 0 || passosChanges.modified.length > 0) {
      changes.areas.passos = true;
      changes.details.passos = passosChanges;
      changes.hasChanges = true;
    }
  }

  return changes;
};

const detectPassosChanges = (
  original: PassoAgente[],
  updated: PassoAgente[]
): {
  added: PassoAgente[];
  removed: PassoAgente[];
  modified: { old: PassoAgente; new: PassoAgente }[];
} => {
  const added: PassoAgente[] = [];
  const removed: PassoAgente[] = [];
  const modified: { old: PassoAgente; new: PassoAgente }[] = [];

  // Passos removidos
  original.forEach(oldPasso => {
    const found = updated.find(newPasso => newPasso.id === oldPasso.id);
    if (!found) {
      removed.push(oldPasso);
    }
  });

  // Passos adicionados e modificados
  updated.forEach(newPasso => {
    const oldPasso = original.find(old => old.id === newPasso.id);
    
    if (!oldPasso) {
      added.push(newPasso);
    } else {
      // Verificar se houve modificação
      const hasChanges = 
        oldPasso.nome !== newPasso.nome ||
        oldPasso.prompt !== newPasso.prompt ||
        oldPasso.ordem !== newPasso.ordem ||
        oldPasso.ativo !== newPasso.ativo ||
        oldPasso.controle !== newPasso.controle;
      
      if (hasChanges) {
        modified.push({ old: oldPasso, new: newPasso });
      }
    }
  });

  return { added, removed, modified };
};

export const generateChangelog = (changes: DetectedChanges): ChangelogData => {
  const areasAlteradas: string[] = [];
  const detalhes: ChangelogData['detalhes'] = {};
  
  // Gerar resumo e detalhes por área
  if (changes.areas.configuracao) {
    areasAlteradas.push('configuracao');
    const configChanges = changes.details.configuracao || [];
    detalhes.configuracao = {
      tipo: 'modificado',
      resumo: `${configChanges.length} configuração(ões) alterada(s)`,
      detalhes: configChanges.map(change => `${change.old} → ${change.new}`)
    };
  }


  if (changes.areas.identidade) {
    areasAlteradas.push('identidade');
    detalhes.identidade = {
      tipo: 'modificado',
      resumo: 'Identidade do agente atualizada'
    };
  }

  if (changes.areas.regras_gerais) {
    areasAlteradas.push('regras_gerais');
    detalhes.regras_gerais = {
      tipo: 'modificado',
      resumo: 'Regras gerais atualizadas'
    };
  }


  if (changes.areas.passos) {
    areasAlteradas.push('passos');
    const passosChanges = changes.details.passos!;
    
    const passosDetalhes: string[] = [];
    if (passosChanges.added.length > 0) {
      passosDetalhes.push(`${passosChanges.added.length} passo(s) adicionado(s)`);
    }
    if (passosChanges.removed.length > 0) {
      passosDetalhes.push(`${passosChanges.removed.length} passo(s) removido(s)`);
    }
    if (passosChanges.modified.length > 0) {
      passosDetalhes.push(`${passosChanges.modified.length} passo(s) modificado(s)`);
    }

    detalhes.passos = {
      tipo: 'modificado',
      resumo: passosDetalhes.join(', '),
      detalhes: [
        ...passosChanges.added.map(passo => `+ Adicionado: ${passo.nome}`),
        ...passosChanges.removed.map(passo => `- Removido: ${passo.nome}`),
        ...passosChanges.modified.map(change => `~ Modificado: ${change.new.nome}`)
      ]
    };
  }

  // Gerar resumo principal
  const totalAreas = areasAlteradas.length;
  let resumo = '';
  
  if (totalAreas === 1) {
    const area = areasAlteradas[0];
    const areaNames = {
      configuracao: 'Configuração',
      identidade: 'Identidade',
      regras_gerais: 'Regras gerais',
      passos: 'Passos'
    };
    resumo = `${areaNames[area as keyof typeof areaNames]} atualizada`;
  } else if (totalAreas === 2) {
    resumo = `2 áreas atualizadas: ${areasAlteradas.join(', ')}`;
  } else {
    resumo = `${totalAreas} áreas atualizadas`;
  }

  return {
    resumo,
    areas_alteradas: areasAlteradas,
    detalhes,
    timestamp: new Date().toISOString()
  };
};

export const parseChangelog = (changelog: string): ChangelogData | null => {
  try {
    const parsed = JSON.parse(changelog) as Record<string, unknown>;
    // Normalize legacy format {summary, changes} → ChangelogData
    if (!parsed.resumo && parsed.summary) {
      return {
        resumo: parsed.summary as string,
        areas_alteradas: [],
        detalhes: {},
        timestamp: (parsed.timestamp as string) ?? new Date().toISOString(),
      };
    }
    return {
      resumo: (parsed.resumo as string) ?? '',
      areas_alteradas: (parsed.areas_alteradas as string[]) ?? [],
      detalhes: (parsed.detalhes as ChangelogData['detalhes']) ?? {},
      timestamp: (parsed.timestamp as string) ?? new Date().toISOString(),
    };
  } catch {
    // Fallback for plain-text changelog
    return {
      resumo: changelog,
      areas_alteradas: [],
      detalhes: {},
      timestamp: new Date().toISOString(),
    };
  }
};

