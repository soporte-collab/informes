import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  color?: 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'gray';
  onClick?: () => void;
  isActive?: boolean;
}

const colorStyles = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-500', border: 'border-blue-200' },
  green: { bg: 'bg-green-50', text: 'text-green-600', ring: 'ring-green-500', border: 'border-green-200' },
  red: { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-500', border: 'border-red-200' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', ring: 'ring-orange-500', border: 'border-orange-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-500', border: 'border-purple-200' },
  gray: { bg: 'bg-gray-50', text: 'text-gray-600', ring: 'ring-gray-500', border: 'border-gray-200' },
};

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  trend,
  trendUp,
  color = "blue",
  onClick,
  isActive = false
}) => {
  const styles = colorStyles[color] || colorStyles.blue;

  return (
    <div
      onClick={onClick}
      className={`
        p-6 rounded-xl shadow-sm border flex flex-col justify-between h-full transition-all duration-200
        ${isActive ? `ring-2 ${styles.ring} ${styles.border} bg-white` : 'border-gray-100 bg-white'}
        ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.98]' : ''}
      `}
    >
      <div className="flex items-center justify-between mb-4">
        <span className={`text-sm font-medium ${isActive ? styles.text : 'text-gray-500'}`}>{title}</span>
        <div className={`p-2 rounded-lg ${styles.bg} ${styles.text}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        {trend && (
          <div className={`flex items-center text-sm ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
            {trendUp ? <ArrowUpRight className="w-4 h-4 mr-1" /> : <ArrowDownRight className="w-4 h-4 mr-1" />}
            <span>{trend}</span>
          </div>
        )}
      </div>
      {onClick && (
        <div className={`mt-3 text-xs font-medium flex items-center gap-1 ${isActive ? styles.text : 'text-gray-400'}`}>
          {isActive ? 'Filtro Activo' : 'Ver detalles'} {isActive ? '✓' : '→'}
        </div>
      )}
    </div>
  );
};