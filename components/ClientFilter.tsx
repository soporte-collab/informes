
import React, { useState, useMemo } from 'react';
import { X, Search, Ban, CheckCircle, ListFilter, Users } from 'lucide-react';

interface ClientFilterProps {
  isOpen: boolean;
  onClose: () => void;
  allClients: string[];
  excludedClients: string[];
  includedClients: string[];
  onToggleExclusion: (clientName: string) => void;
  onToggleInclusion: (clientName: string) => void;
}

export const ClientFilter: React.FC<ClientFilterProps> = ({
  isOpen,
  onClose,
  allClients,
  excludedClients,
  includedClients,
  onToggleExclusion,
  onToggleInclusion,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'exclude' | 'include'>('include');

  const filteredClients = useMemo(() => {
    // 1. First remove any null/undefined entries completely
    let clients = (allClients || []).filter(c => c != null); // Added defensive check for allClients

    // 2. Search filter (Safe check)
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      clients = clients.filter(c => String(c).toLowerCase().includes(lowerTerm));
    }

    // 3. Sort logic: active items first (Safe checks)
    clients = clients.sort((a, b) => {
      const strA = String(a || "");
      const strB = String(b || "");

      const aActive = activeTab === 'exclude' ? excludedClients.includes(strA) : includedClients.includes(strA);
      const bActive = activeTab === 'exclude' ? excludedClients.includes(strB) : includedClients.includes(strB);

      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      return strA.localeCompare(strB);
    });

    return clients.slice(0, 100); // Limit display for performance
  }, [allClients, excludedClients, includedClients, searchTerm, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-biosalud-600" />
              Filtrar Clientes / Entidades
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Excluya convenios masivos (ej: Asociart) o filtre por cliente específico.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'include'
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            onClick={() => setActiveTab('include')}
          >
            <CheckCircle className="w-4 h-4" />
            Solo Mostrar (Inclusiones)
            {includedClients.length > 0 && <span className="bg-blue-100 text-blue-700 text-xs px-2 rounded-full">{includedClients.length}</span>}
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'exclude'
                ? 'border-red-500 text-red-600 bg-red-50'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            onClick={() => setActiveTab('exclude')}
          >
            <Ban className="w-4 h-4" />
            Ocultar (Exclusiones)
            {excludedClients.length > 0 && <span className="bg-red-100 text-red-700 text-xs px-2 rounded-full">{excludedClients.length}</span>}
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50/50 p-3 text-xs text-blue-800 text-center border-b border-blue-100">
          {activeTab === 'include'
            ? "Seleccione los clientes que desea VER. Si la lista está vacía, se muestran todos."
            : "Seleccione clientes masivos (Obras Sociales, Convenios) para ELIMINARLOS de las métricas."}
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente (ej: Asociart, Perez)..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-biosalud-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 bg-gray-50">
          {filteredClients.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              No se encontraron clientes
            </div>
          ) : (
            <div className="space-y-1">
              {filteredClients.map((client) => {
                const isIncluded = includedClients.includes(client);
                const isExcluded = excludedClients.includes(client);

                // Determine state based on active tab
                const isActive = activeTab === 'include' ? isIncluded : isExcluded;
                const toggleFn = activeTab === 'include' ? onToggleInclusion : onToggleExclusion;

                return (
                  <button
                    key={client}
                    onClick={() => toggleFn(client)}
                    className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all ${isActive
                        ? (activeTab === 'include' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200')
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-transparent'
                      }`}
                  >
                    <span className="truncate pr-4 text-sm font-medium">{client}</span>
                    {isActive ? (
                      activeTab === 'include' ? (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Ban className="w-5 h-5 text-red-600" />
                      )
                    ) : (
                      <span className="w-5 h-5 border-2 border-gray-300 rounded-full"></span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="bg-biosalud-600 hover:bg-biosalud-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
