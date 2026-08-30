import { useSystemModules } from "@/hooks/useSystemModules";

/**
 * Debug Component: Shows all modules from database
 * Add this to your page temporarily to debug module loading
 *
 * Usage in any page:
 * import ModulesDebug from "@/components/debug/ModulesDebug";
 *
 * Then add: <ModulesDebug /> anywhere on the page
 */
export const ModulesDebug = () => {
  const { modules, activeModules, isLoading } = useSystemModules();

  if (isLoading) {
    return <div className="p-4 text-sm">Loading modules...</div>;
  }

  console.log("🔍 MODULES DEBUG:", {
    total: modules.length,
    active: activeModules.length,
    modules: modules.map(m => ({
      key: m.module_key,
      name: m.module_name,
      active: m.is_active,
      order: m.order_index,
      icon: m.icon,
    })),
  });

  return (
    <div className="p-4 bg-slate-900 text-white rounded-lg font-mono text-xs space-y-4 max-w-4xl mx-auto my-4">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-blue-400">📊 Modules Debug Info</h3>
        <p className="text-yellow-400">
          Total Modules: <span className="font-bold">{modules.length}</span>
        </p>
        <p className="text-green-400">
          Active Modules: <span className="font-bold">{activeModules.length}</span>
        </p>
      </div>

      <div className="border border-slate-700 p-3 rounded">
        <h4 className="text-cyan-400 font-bold mb-2">All Modules:</h4>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-600 text-cyan-300">
              <th className="pb-2 px-2">Key</th>
              <th className="pb-2 px-2">Name</th>
              <th className="pb-2 px-2">Ativo</th>
              <th className="pb-2 px-2">Order</th>
              <th className="pb-2 px-2">Icon</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr
                key={m.module_key}
                className={`border-b border-slate-700 ${
                  m.is_active ? "bg-green-900/20" : "bg-red-900/20"
                }`}
              >
                <td className="py-2 px-2 text-purple-400">{m.module_key}</td>
                <td className="py-2 px-2">{m.module_name}</td>
                <td className="py-2 px-2">
                  {m.is_active ? (
                    <span className="text-green-400">✓ true</span>
                  ) : (
                    <span className="text-red-400">✗ false</span>
                  )}
                </td>
                <td className="py-2 px-2 text-orange-400">{m.order_index}</td>
                <td className="py-2 px-2 text-blue-400">{m.icon}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border border-slate-700 p-3 rounded bg-slate-800/50">
        <h4 className="text-cyan-400 font-bold mb-2">Expected Modules (12):</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { key: "dashboard", name: "BI PRO™" },
            { key: "conversas", name: "OMNI PRO™" },
            { key: "call", name: "CALL PRO™" },
            { key: "disparos", name: "SENDS PRO™" },
            { key: "agendamentos", name: "SCHEDULE PRO™" },
            { key: "score", name: "SCORE PRO™" },
            { key: "agentes-ia", name: "AI AGENTS PRO™" },
            { key: "lp", name: "LP PRO™" },
            { key: "negocios", name: "Negócios" },
            { key: "clientes", name: "Clientes" },
            { key: "followups", name: "Follow-ups" },
            { key: "configuracoes", name: "Configurações" },
          ].map((expected) => {
            const found = modules.find((m) => m.module_key === expected.key);
            return (
              <div key={expected.key}>
                {found ? (
                  <span className="text-green-400">
                    ✓ {expected.key}
                  </span>
                ) : (
                  <span className="text-red-400">
                    ✗ {expected.key} (MISSING!)
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-muted-foreground text-xs">
        <p>💡 Open Console (F12) to see detailed log</p>
        <p>Check Supabase Dashboard → SQL Editor to verify database state</p>
      </div>
    </div>
  );
};

export default ModulesDebug;
