// Single-tenant mode - provides empty tenant list for backward compatibility
export const useTenants = () => {
  return {
    tenants: [],
    isLoading: false,
    error: null,
  };
};
