// TODO: este hook é um placeholder. Para mutações reais usar useAtualizarPessoaComplete.
// Placeholder: nenhum caller atual. Se for chamado, alerta no console em DEV para evitar regressão silenciosa.
export const useAtualizarPessoa = () => {
  if (import.meta.env.DEV) {
    console.warn('[useAtualizarPessoa] Stub hook chamado — não persiste alterações. Use useAtualizarPessoaComplete.');
  }
  return {
    mutate: () => {},
    mutateAsync: () => Promise.resolve(null),
    isPending: false,
    isError: false,
  };
};
