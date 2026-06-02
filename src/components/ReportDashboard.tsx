import { DailyLog } from '../types';
import { formatLocalDateStr, getWeekdayLabel } from '../utils';
import { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line 
} from 'recharts';
import { 
  Calendar, Eye, ChevronDown, Award, Sparkles, Smile, ShieldAlert, Heart, CalendarRange, Clock, BookOpen, Printer 
} from 'lucide-react';

interface ReportDashboardProps {
  logs: DailyLog[];
  childName?: string;
}

type PeriodType = 'week' | 'month' | 'year' | 'custom';

export default function ReportDashboard({ logs, childName = "Criança" }: ReportDashboardProps) {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [startDateStr, setStartDateStr] = useState<string>(() => {
    // 30 days ago default
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDateStr, setEndDateStr] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Filter logs by selected date period
  const filteredLogs = useMemo(() => {
    const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
    if (sortedLogs.length === 0) return [];

    const now = new Date();
    let limitDate = new Date();

    if (period === 'week') {
      limitDate.setDate(now.getDate() - 7);
      return sortedLogs.filter(log => new Date(log.date + 'T12:00:00') >= limitDate);
    } else if (period === 'month') {
      limitDate.setDate(now.getDate() - 30);
      return sortedLogs.filter(log => new Date(log.date + 'T12:00:00') >= limitDate);
    } else if (period === 'year') {
      limitDate.setFullYear(now.getFullYear() - 1);
      return sortedLogs.filter(log => new Date(log.date + 'T12:00:00') >= limitDate);
    } else {
      // Custom date range
      const start = startDateStr ? new Date(startDateStr + 'T00:00:00') : new Date(0);
      const end = endDateStr ? new Date(endDateStr + 'T23:59:59') : new Date();
      return sortedLogs.filter(log => {
        const logDate = new Date(log.date + 'T12:00:00');
        return logDate >= start && logDate <= end;
      });
    }
  }, [logs, period, startDateStr, endDateStr]);

  // Calculations for reports kpi summaries
  const stats = useMemo(() => {
    const totalDays = filteredLogs.length;
    if (totalDays === 0) {
      return {
        totalDays: 0,
        totalSeizures: 0,
        avgSleep: 0,
        avgQuality: 0,
        medCompliance: 0,
        seizureDays: 0,
        morningCrises: 0,
        afternoonCrises: 0,
        nightCrises: 0,
        triggersRank: [] as { trigger: string; count: number }[]
      };
    }

    let totalSeizures = 0;
    let sleepDurationSum = 0;
    let sleepCount = 0;
    let qualitySum = 0;
    let medicationDays = 0;
    let seizureDaysCount = 0;
    let morningCrises = 0;
    let afternoonCrises = 0;
    let nightCrises = 0;

    const triggersMap: { [key: string]: number } = {};

    filteredLogs.forEach(log => {
      // Seizures
      if (log.seizures.occurred) {
        seizureDaysCount++;
        totalSeizures += log.seizures.totalCount;
        morningCrises += log.seizures.morningCount || 0;
        afternoonCrises += log.seizures.afternoonCount || 0;
        nightCrises += log.seizures.nightCount || 0;

        // Count triggers
        if (log.seizures.triggers) {
          log.seizures.triggers.split(',').forEach(t => {
            const clean = t.trim();
            if (clean) {
              triggersMap[clean] = (triggersMap[clean] || 0) + 1;
            }
          });
        }
      }

      // Sleep
      if (log.sleep.status !== 'não dormiu') {
        sleepDurationSum += log.sleep.hoursSlept || 0;
        sleepCount++;
      }
      qualitySum += log.sleep.quality || 0;

      // Meds
      if (log.medication.taken) {
        medicationDays++;
      }
    });

    const triggersRank = Object.entries(triggersMap)
      .map(([trigger, count]) => ({ trigger, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalDays,
      totalSeizures,
      avgSleep: sleepCount > 0 ? parseFloat((sleepDurationSum / sleepCount).toFixed(1)) : 0,
      avgQuality: parseFloat((qualitySum / totalDays).toFixed(1)),
      medCompliance: Math.round((medicationDays / totalDays) * 100),
      seizureDays: seizureDaysCount,
      morningCrises,
      afternoonCrises,
      nightCrises,
      triggersRank
    };
  }, [filteredLogs]);

  // Chart structured datasets
  const chartData = useMemo(() => {
    return filteredLogs.map(log => {
      const displayDate = log.date.substring(5).split('-').reverse().join('/'); // MM/DD format or DD/MM
      const weekday = getWeekdayLabel(log.date);
      
      return {
        name: `${weekday} ${displayDate}`,
        'Crises Totais': log.seizures.totalCount || 0,
        'Manhã': log.seizures.morningCount || 0,
        'Tarde': log.seizures.afternoonCount || 0,
        'Noite/Despertar': log.seizures.nightCount || 0,
        'Duração do Sono (h)': log.sleep.status === 'não dormiu' ? 0 : log.sleep.hoursSlept || 0,
        'Qualidade Sono': log.sleep.quality || 0,
        'Acordou': log.sleep.wakeUpCount || 0
      };
    });
  }, [filteredLogs]);

  const handlePrint = () => {
    window.print();
  };

  const getPeriodRangeText = () => {
    let baseText = "";
    if (period === 'week') {
      baseText = "Últimos 7 dias";
    } else if (period === 'month') {
      baseText = "Últimos 30 dias";
    } else if (period === 'year') {
      baseText = "Últimos 365 dias";
    } else if (period === 'custom') {
      if (startDateStr && endDateStr) {
        if (startDateStr === endDateStr) {
          baseText = `Dia específico: ${formatLocalDateStr(startDateStr)}`;
        } else {
          baseText = `Período: ${formatLocalDateStr(startDateStr)} até ${formatLocalDateStr(endDateStr)}`;
        }
      } else {
        baseText = "Período personalizado";
      }
    }

    if (filteredLogs.length === 0) {
      return `${baseText} (Não há registros salvos nesta data)`;
    }
    
    return baseText;
  };

  return (
    <div className="space-y-6" id="reports-dashboard">
      {/* Cabeçalho exclusivo para Impressão Médica (oculto no app principal com no-print) */}
      <div className="hidden print:block bg-white border-b border-slate-200 pb-5 mb-4 font-sans">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">Monitor de Crises e Sono</h1>
            <p className="text-xs text-slate-500 font-medium mt-1">Histórico Clínico Detalhado para o Neurologista Pediátrico</p>
          </div>
          <div className="text-right text-xs text-slate-700 space-y-1">
            <p className="font-bold text-slate-800 text-sm"><span className="text-slate-400 font-normal">Criança/Paciente:</span> {childName}</p>
            <p className="font-semibold text-rose-500"><span className="text-slate-400 font-normal">Período:</span> {getPeriodRangeText()}</p>
            <p className="text-[10px] text-slate-400 mt-1"><span className="text-slate-400 font-normal">Emitido em:</span> {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </div>

      {/* Search selection top panel */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Relatórios e Estatísticas</h2>
          <p className="text-xs text-slate-400 mb-1.5 font-medium text-slate-400">Analise tendências, hábitos e correlacione desvios no sono ou medicamentos</p>
          <div className="text-xs font-bold text-rose-500 bg-rose-50/50 px-3 py-1 rounded-xl border border-rose-100/50 inline-block shadow-2xs">
            {getPeriodRangeText()}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'week', label: 'Semanal' },
            { id: 'month', label: 'Mensal' },
            { id: 'year', label: 'Anual' },
            { id: 'custom', label: 'Intervalo de Data' }
          ].map(p => (
            <button
              type="button"
              key={p.id}
              onClick={() => setPeriod(p.id as PeriodType)}
              className={`text-xs font-semibold px-4 py-2 rounded-xl border transition-all cursor-pointer select-none ${
                period === p.id 
                  ? 'bg-rose-500 border-rose-500 text-white shadow-sm' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}

          <button
            type="button"
            id="btn-print-report"
            onClick={handlePrint}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition cursor-pointer flex gap-1.5 items-center text-xs font-semibold select-none ml-auto md:ml-0"
            title="Imprimir relatório para levar ao médico"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Date picker for custom dates */}
      {period === 'custom' && (
        <div className="bg-slate-100 p-4 rounded-2xl flex flex-wrap gap-4 items-center no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Período de:</span>
            <input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-rose-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase">Até:</span>
            <input
              type="date"
              value={endDateStr}
              onChange={(e) => setEndDateStr(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-rose-400"
            />
          </div>
        </div>
      )}

      {/* Empty States */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center">
          <CalendarRange className="h-12 w-12 text-slate-300 mb-3" />
          <p className="font-bold text-slate-700">Nenhum registro encontrado no período</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Adicione um diário clínico ou selecione outra parametrização para exibir análises integradas.
          </p>
        </div>
      ) : (
        <>
          {/* Dashboard Bento KPI Blocks */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Box 1: Seizures amount */}
            <div className="p-5 bg-gradient-to-br from-rose-50 to-white rounded-3xl border border-rose-100/50 shadow-xs flex flex-col justify-between">
              <div>
                <Heart className="h-5 w-5 text-rose-500 fill-current mb-3" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total de Crises</span>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-extrabold text-rose-600 block">{stats.totalSeizures}</span>
                <span className="text-[10px] text-slate-400 leading-tight">Em {stats.seizureDays} de {stats.totalDays} dias registrados</span>
              </div>
            </div>

            {/* Box 2: Sleep Duration */}
            <div className="p-5 bg-gradient-to-br from-indigo-50 to-white rounded-3xl border border-indigo-100/50 shadow-xs flex flex-col justify-between">
              <div>
                <Clock className="h-5 w-5 text-indigo-500 mb-3" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Média de Sono</span>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-extrabold text-indigo-800 block">{stats.avgSleep}h</span>
                <span className="text-[10px] text-slate-400 leading-tight">Por noite repousada</span>
              </div>
            </div>

            {/* Box 3: Sleep Quality */}
            <div className="p-5 bg-gradient-to-br from-amber-50 to-white rounded-3xl border border-amber-100/50 shadow-xs flex flex-col justify-between">
              <div>
                <Smile className="h-5 w-5 text-amber-500 mb-3" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Qualidade Sono</span>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-extrabold text-amber-700 block">{stats.avgQuality} <span className="text-xs font-semibold text-slate-400">/ 5</span></span>
                <span className="text-[10px] text-slate-400 leading-tight">Qualidade geral média do sono</span>
              </div>
            </div>

            {/* Box 4: Med Compliance */}
            <div className="p-5 bg-gradient-to-br from-emerald-50 to-white rounded-3xl border border-emerald-100/50 shadow-xs flex flex-col justify-between">
              <div>
                <Award className="h-5 w-5 text-emerald-500 mb-3" />
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Adesão a Remédios</span>
              </div>
              <div className="mt-2.5">
                <span className="text-2xl font-extrabold text-emerald-700 block">{stats.medCompliance}%</span>
                <span className="text-[10px] text-slate-400 leading-tight">Pontualidade no tratamento</span>
              </div>
            </div>

          </div>

          {/* Interactive Recharts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart: Total seizures stacked periods */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-md">
              <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-700">Frequência de Crises no Tempo</h4>
                  <p className="text-[10px] text-slate-400">Distribuição segmentada por horários ocorrido</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] bg-rose-50 px-2 py-0.5 rounded text-rose-700 font-extrabold shadow-xs">Total: {stats.totalSeizures}</span>
                </div>
              </div>

              <div className="h-64 text-xs font-medium">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Manhã" stackId="a" fill="#38bdf8" />
                    <Bar dataKey="Tarde" stackId="a" fill="#fb923c" />
                    <Bar dataKey="Noite/Despertar" stackId="a" fill="#818cf8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart: Sleep Quality vs Sleep Duration */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-md">
              <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-2">
                <div>
                  <h4 className="font-bold text-sm text-slate-700">Comportamento de Sono (Horas vs Qualidade)</h4>
                  <p className="text-[10px] text-slate-400">Correlacione a duração do sono com o aproveitamento diário</p>
                </div>
              </div>

              <div className="h-64 text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Duração do Sono (h)" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="Qualidade Sono" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Triggers Ranking */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-md lg:col-span-1">
              <div className="border-b border-slate-50 pb-2 mb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-700">Ranking de Gatilhos</h4>
                  <p className="text-[10px] text-slate-400">Agentes que provocaram mais crises listados</p>
                </div>
                <Sparkles className="h-4 w-4 text-rose-500 fill-current" />
              </div>

              {stats.triggersRank.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nenhum gatilho observado neste intervalo.
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.triggersRank.map((t, idx) => {
                    const pct = Math.round((t.count / stats.seizureDays) * 100);
                    return (
                      <div key={t.trigger} className="space-y-1 bg-slate-50/50 p-2 rounded-xl">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-700 flex gap-2">
                            <span className="text-[10px] text-slate-400">#{idx + 1}</span>
                            {t.trigger}
                          </span>
                          <span className="text-slate-500 text-[10px] font-semibold">{t.count}x</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div 
                            className="bg-rose-500 h-1.5 rounded-full" 
                            style={{ width: `${Math.min(100, Math.max(8, pct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* List entries for doctors print-friendly */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-md lg:col-span-2">
              <div className="border-b border-slate-50 pb-2 mb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-slate-700">Observações Clínicas Detalhadas</h4>
                  <p className="text-[10px] text-slate-400">Anote e exporte este histórico para levar ao neurologista pediátrico</p>
                </div>
                <BookOpen className="h-4 w-4 text-indigo-500" />
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {filteredLogs.map(log => {
                  const hasCrises = log.seizures.occurred;
                  return (
                    <div 
                      key={log.date} 
                      className={`p-3 rounded-2xl border text-xs space-y-1.5 ${
                        hasCrises 
                          ? 'bg-rose-50/20 border-rose-100' 
                          : 'bg-slate-50/20 border-slate-100'
                      }`}
                    >
                      <div className="flex justify-between items-center border-b border-dotted border-slate-200 pb-1">
                        <span className="font-bold text-slate-700">
                          {formatLocalDateStr(log.date)} ({getWeekdayLabel(log.date)})
                        </span>
                        <div className="flex gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            hasCrises ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {hasCrises ? `${log.seizures.totalCount} crises` : 'Sem crise'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            log.medication.taken ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {log.medication.taken ? 'Medicamento OK' : 'Sem remédio'}
                          </span>
                        </div>
                      </div>

                      {/* Observations text row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-600">
                        <div>
                          <p className="font-bold text-[9px] text-slate-400 uppercase">Anotações Sono:</p>
                          <p className="mt-0.5 italic leading-relaxed text-slate-500 font-medium">
                            {log.sleep.observations || 'Nenhuma anormalidade no padrão de descanso.'}
                          </p>
                        </div>
                        <div>
                          <p className="font-bold text-[9px] text-slate-400 uppercase">Comportamento de Crises / Bem-estar:</p>
                          <p className="mt-0.5 italic leading-relaxed text-rose-900/80 font-medium">
                            {log.seizures.observations || log.seizures.triggers 
                              ? `${log.seizures.triggers ? `[Gatilhos: ${log.seizures.triggers}] ` : ''}${log.seizures.observations || ''}` 
                              : 'Dia tranquilo, sem alterações.'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
