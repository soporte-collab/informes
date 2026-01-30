
import React, { useState, useMemo } from 'react';
import { X, Search, Ban, CheckCircle, Users } from 'lucide-react';

interface EntityFilterProps {
  isOpen: boolean;
  onClose: () => void;
  allEntities: string[];
  excludedEntities: string[];
  includedEntities: string[];
  onToggleExclusion: (entityName: string) => void;
  onToggleInclusion: (entityName: string) => void;
}

export const EntityFilter: React.FC<EntityFilterProps> = ({
  isOpen,
  onClose,
  allEntities,
  excludedEntities,
  includedEntities,
  onToggleExclusion,
  onToggleInclusion,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'exclude' | 'include'>('include');

  const filteredEntities = useMemo(() => {
    // 1. Safety check for legacy data
    let entities = allEntities.filter(e => e != null && e !== "");
    
    // 2. Search filter (Robust string conversion)
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      entities = entities.filter(e => String(e).toLowerCase().includes(lowerTerm));
    }
    
    // 3. Sort logic: active items first
    entities = entities.sort((a, b) => {
        const strA = String(a || "");
        const strB = String(b || "");
        
        const aActive = activeTab === 'exclude' ? excludedEntities.includes(strA) : includedEntities.includes(strA);
        const bActive = activeTab === 'exclude' ? excludedEntities.includes(strB) : includedEntities.includes(strB);
        
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        
        return strA.localeCompare(strB);
    });

    return entities.slice(0, 100); 
  }, [allEntities, excludedEntities, includedEntities, searchTerm, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-biosalud-600" />
              Filtrar Entidades (Convenios/Obras Sociales)
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Filtre por entidad agrupadora (ej: Asociart, Swiss Medical) para limpiar métricas.
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
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                    activeTab === 'include' 
                    ? 'border-blue-500 text-blue-600 bg-blue-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('include')}
            >
                <CheckCircle className="w-4 h-4" />
                Solo Mostrar
                {includedEntities.length > 0 && <span className="bg-blue-100 text-blue-700 text-xs px-2 rounded-full">{includedEntities.length}</span>}
            </button>
            <button
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                    activeTab === 'exclude' 
                    ? 'border-red-500 text-red-600 bg-red-50' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('exclude')}
            >
                <Ban className="w-4 h-4" />
                Ocultar (Excluir)
                {excludedEntities.length > 0 && <span className="bg-red-100 text-red-700 text-xs px-2 rounded-full">{excludedEntities.length}</span>}
            </button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50/50 p-3 text-xs text-blue-800 text-center border-b border-blue-100">
            {activeTab === 'include' 
                ? "Seleccione entidades para analizar EXCLUSIVAMENTE (ej: solo PAMI)." 
                : "Seleccione entidades masivas para ELIMINARLAS de las métricas de mostrador."}
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar entidad (ej: Asociart)..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-biosalud-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 bg-gray-50">
          {filteredEntities.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              No se encontraron entidades
            </div>
          ) : (
            <div className="space-y-1">
              {filteredEntities.map((entity) => {
                const isIncluded = includedEntities.includes(entity);
                const isExcluded = excludedEntities.includes(entity);
                
                const isActive = activeTab === 'include' ? isIncluded : isExcluded;
                const toggleFn = activeTab === 'include' ? onToggleInclusion : onToggleExclusion;

                return (
                  <button
                    key={entity}
                    onClick={() => toggleFn(entity)}
                    className={`w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-all ${
                      isActive 
                        ? (activeTab === 'include' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200')
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <span className="truncate pr-4 text-sm font-medium">{entity}</span>
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
