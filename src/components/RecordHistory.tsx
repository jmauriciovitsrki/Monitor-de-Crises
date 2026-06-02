import { DailyLog } from '../types';
import { formatLocalDateStr, getWeekdayLabel } from '../utils';
import { 
  Heart, Trash2, Edit3, Moon, Pill, AlertCircle, Sparkles, Smile, ShieldAlert, BadgeInfo 
} from 'lucide-react';

interface RecordHistoryProps {
  logs: DailyLog[];
  onEdit: (log: DailyLog) => void;
  onDelete: (date: string) => Promise<void>;
}

export default function RecordHistory({ logs, onEdit, onDelete }: RecordHistoryProps) {
  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));

  const handleDeleteClick = async (date: string) => {
    if (confirm(`Tem certeza que deseja excluir permanentemente o registro do dia ${date.split('-').reverse().join('/')}?`)) {
      try {
        await onDelete(date);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-4" id="record-history">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-slate-800">Diário de Atividades Clínicas</h3>
          <p className="text-xs text-slate-400">Exibindo histórico completo por ordem cronológica decrescente</p>
        </div>
        <span className="text-xs bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full border border-slate-200">
          {logs.length} {logs.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {sortedLogs.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-100 shadow-sm flex flex-col items-center">
          <BadgeInfo className="h-10 w-10 text-slate-300 mb-3" />
          <p className="font-bold text-slate-700 text-sm">Histórico sem preenchimentos</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Utilize o botão superior "Novo Registro Diário" para preencher seu primeiro diário clínico.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {sortedLogs.map((log) => {
            const hasCrises = log.seizures.occurred;
            
            return (
              <div 
                key={log.date}
                className={`bg-white rounded-2xl border transition shadow-xs hover:shadow-md p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  hasCrises 
                    ? 'border-rose-100 bg-rose-50/10' 
                    : 'border-slate-100 hover:border-slate-200'
                }`}
                id={`history-row-${log.date}`}
              >
                {/* Log Info Date */}
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 ${
                    hasCrises 
                      ? 'bg-rose-500 text-white shadow-sm' 
                      : 'bg-slate-100 text-slate-600 border border-slate-200/50'
                  }`}>
                    <span className="text-[10px] uppercase font-bold tracking-tight">
                      {getWeekdayLabel(log.date)}
                    </span>
                    <span className="text-base font-black tracking-tight leading-none mt-1">
                      {log.date.substring(8)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-800">
                        {formatLocalDateStr(log.date)}
                      </span>
                      {hasCrises ? (
                        <span className="bg-rose-100 text-rose-800 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 leading-none shadow-xs border border-rose-200">
                          <AlertCircle className="h-2.5 w-2.5" />
                          Teve Crise: {log.seizures.totalCount}
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full leading-none border border-emerald-200">
                          Sem crises convulsivas
                        </span>
                      )}
                    </div>
                    
                    {/* Sleep indicators row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-[11px]">
                      <span className="flex items-center gap-1 font-medium capitalize">
                        <Moon className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                        {log.sleep.status} {log.sleep.status !== 'não dormiu' ? `(${log.sleep.hoursSlept}h)` : ''}
                      </span>
                      {log.sleep.status !== 'não dormiu' && (
                        <span className="text-slate-400">
                          Qualidade: {log.sleep.quality}⭐ • Wakes: {log.sleep.wakeUpCount}
                        </span>
                      )}
                      <span className="flex items-center gap-1 font-medium">
                        <Pill className={`h-3.5 w-3.5 flex-shrink-0 ${log.medication.taken ? 'text-emerald-500' : 'text-amber-500'}`} />
                        Medicação: {log.medication.taken ? 'Sim' : 'Não'}
                      </span>
                    </div>

                    {hasCrises && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-500 font-bold text-[10px] mt-1 pt-1 border-t border-slate-100">
                        <span className="text-[9px] uppercase tracking-tight text-slate-400">Intensidade:</span>
                        <span className="text-emerald-600 flex items-center gap-0.5">🟢 Fracas (Leves): {((log.seizures.morningDetails?.light || 0) + (log.seizures.afternoonDetails?.light || 0) + (log.seizures.nightDetails?.light || 0))}</span>
                        <span className="text-amber-600 flex items-center gap-0.5">🟡 Médias: {((log.seizures.morningDetails?.medium || 0) + (log.seizures.afternoonDetails?.medium || 0) + (log.seizures.nightDetails?.medium || 0))}</span>
                        <span className="text-rose-650 flex items-center gap-0.5">🔴 Fortes: {((log.seizures.morningDetails?.strong || 0) + (log.seizures.afternoonDetails?.strong || 0) + (log.seizures.nightDetails?.strong || 0))}</span>
                      </div>
                    )}

                    {/* Observations Row text snippet if exists */}
                    {(log.seizures.observations || log.sleep.observations) && (
                      <p className="text-[11px] text-slate-400 italic max-w-md line-clamp-1 pt-0.5 leading-relaxed">
                        {log.seizures.observations || log.sleep.observations}
                      </p>
                    )}
                  </div>
                </div>

                {/* Log Controls */}
                <div className="flex items-center gap-1 self-end md:self-center border-t md:border-none border-slate-100 pt-2.5 md:pt-0 w-full md:w-auto justify-end">
                  <button
                    type="button"
                    id={`btn-edit-${log.date}`}
                    onClick={() => onEdit(log)}
                    className="p-2 hover:bg-slate-100 text-slate-600 hover:text-slate-800 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold select-none border border-transparent hover:border-slate-200"
                    title="Editar diário"
                  >
                    <Edit3 className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    id={`btn-delete-${log.date}`}
                    onClick={() => handleDeleteClick(log.date)}
                    className="p-2 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold select-none border border-transparent hover:border-rose-100"
                    title="Excluir diário"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
