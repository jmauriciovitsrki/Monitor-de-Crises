import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Calendar, Clock, Plus, Trash2, Edit2, ChevronLeft, ChevronRight, 
  AlertCircle, Sparkles, Check, Pill, Info, CalendarClock, Activity
} from 'lucide-react';
import { Medication } from '../types';

interface MedicationAgendaProps {
  medications: Medication[];
  onSaveMedication: (med: Partial<Medication>) => Promise<void>;
  onDeleteMedication: (id: string) => Promise<void>;
  onClose: () => void;
  childName: string;
}

const WEEKDAYS_MAP = [
  { abbr: 'seg', label: 'Seg' },
  { abbr: 'ter', label: 'Ter' },
  { abbr: 'qua', label: 'Qua' },
  { abbr: 'qui', label: 'Qui' },
  { abbr: 'sex', label: 'Sex' },
  { abbr: 'sab', label: 'Sáb' },
  { abbr: 'dom', label: 'Dom' }
];

export default function MedicationAgenda({ 
  medications, 
  onSaveMedication, 
  onDeleteMedication, 
  onClose,
  childName
}: MedicationAgendaProps) {
  const [activeTab, setActiveTab] = useState<'agenda' | 'list'>('agenda');
  const [weekOffset, setWeekOffset] = useState<number>(0);
  
  // Form view states
  const [showForm, setShowForm] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  
  // Form input states
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [type, setType] = useState<'recurrent' | 'temporary'>('recurrent');
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  
  // Feedback alerts
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Helper date generation (robust against midnight timezone offsets)
  const getDaysOfWeek = (offset: number) => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    
    // Calculate Monday of the target offset week
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const targetMonday = new Date(today);
    targetMonday.setDate(today.getDate() + mondayOffset + (offset * 7));
    
    const weekdayNames = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
    const weekdayAbbrs = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(targetMonday);
      d.setDate(targetMonday.getDate() + i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      weekDays.push({
        dateStr,
        dayName: weekdayNames[i],
        dayAbbr: weekdayAbbrs[i],
        formattedDate: `${day}/${month}`,
        isToday: dateStr === new Date().toISOString().split('T')[0]
      });
    }
    return weekDays;
  };

  const currentWeekDays = getDaysOfWeek(weekOffset);

  // Filter and match medications for a given day
  const getMedicationsForDay = (dateStr: string, dayAbbr: string) => {
    return medications.filter(med => {
      if (med.type === 'recurrent') {
        return med.recurrenceDays.includes(dayAbbr);
      } else {
        // Compare dates (inclusive)
        if (!med.startDate) return false;
        const currentMs = new Date(dateStr + 'T12:00:00').getTime();
        const startMs = new Date(med.startDate + 'T12:00:00').getTime();
        
        if (med.endDate) {
          const endMs = new Date(med.endDate + 'T12:00:00').getTime();
          return currentMs >= startMs && currentMs <= endMs;
        }
        return currentMs >= startMs;
      }
    }).flatMap(med => {
      // Return a record for each time slot to schedule nicely
      return med.times.map(time => ({
        ...med,
        time
      }));
    }).sort((a, b) => a.time.localeCompare(b.time));
  };

  // Open creation form
  const handleOpenAddForm = () => {
    setEditingMed(null);
    setName('');
    setDosage('');
    setTimes(['08:00']);
    setType('recurrent');
    setRecurrenceDays(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setErrorMessage(null);
    setShowForm(true);
  };

  // Open edit form
  const handleOpenEditForm = (med: Medication) => {
    setEditingMed(med);
    setName(med.name);
    setDosage(med.dosage);
    setTimes(med.times.length > 0 ? med.times : ['08:00']);
    setType(med.type);
    setRecurrenceDays(med.recurrenceDays);
    setStartDate(med.startDate || new Date().toISOString().split('T')[0]);
    setEndDate(med.endDate || '');
    setErrorMessage(null);
    setShowForm(true);
  };

  const handleAddTimeField = () => {
    setTimes([...times, '08:00']);
  };

  const handleRemoveTimeField = (index: number) => {
    if (times.length <= 1) return;
    setTimes(times.filter((_, idx) => idx !== index));
  };

  const handleUpdateTimeField = (index: number, val: string) => {
    const updated = [...times];
    updated[index] = val;
    setTimes(updated);
  };

  // Toggle standard recurrence day selection
  const handleToggleRecurrenceDay = (dayAbbr: string) => {
    if (recurrenceDays.includes(dayAbbr)) {
      setRecurrenceDays(recurrenceDays.filter(d => d !== dayAbbr));
    } else {
      setRecurrenceDays([...recurrenceDays, dayAbbr]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Hard validation
    if (!name.trim()) return setErrorMessage('O nome do medicamento é obrigatório.');
    if (!dosage.trim()) return setErrorMessage('A dosagem (ex: 5 gotas, 1 comprimido) é obrigatória.');
    
    // Filter invalid times
    const cleanTimes = times.map(t => t.trim()).filter(Boolean).sort();
    if (cleanTimes.length === 0) return setErrorMessage('É necessário definir ao menos 1 horário de administração.');

    if (type === 'recurrent' && recurrenceDays.length === 0) {
      return setErrorMessage('Selecione pelo menos um dia da semana para medicação de uso contínuo.');
    }

    if (type === 'temporary') {
      if (!startDate) return setErrorMessage('Defina a data de início para o período da medicação.');
      if (endDate && startDate > endDate) {
        return setErrorMessage('A data de fim não pode ser anterior à data de início.');
      }
    }

    setIsSaving(true);
    try {
      const payload: Partial<Medication> = {
        name: name.trim(),
        dosage: dosage.trim(),
        times: cleanTimes,
        type,
        recurrenceDays: type === 'recurrent' ? recurrenceDays : [],
        startDate: type === 'temporary' ? startDate : '',
        endDate: type === 'temporary' && endDate ? endDate : '',
      };

      if (editingMed?.id) {
        payload.id = editingMed.id;
      }

      await onSaveMedication(payload);
      setShowForm(false);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro ao registrar medicação.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja excluir o cadastro do medicamento "${name}"?`)) {
      try {
        await onDeleteMedication(id);
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir medicamento.');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-slate-50 w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl border border-white flex flex-col md:h-[85vh] h-[95vh] relative"
      >
        {/* Header section */}
        <div className="bg-white px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-amber-50 p-2.5 rounded-2xl border border-amber-100">
              <Pill className="h-6 w-6 text-amber-600 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Agenda de Medicamentos</h2>
              <p className="text-[11px] text-slate-400 font-semibold">Terapia diária e recorrente de {childName}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="bg-white/80 px-6 py-2 border-b border-slate-100 flex items-center justify-between shrink-0 flex-wrap gap-2">
          <div className="flex bg-slate-100/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('agenda')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition select-none cursor-pointer ${
                activeTab === 'agenda' 
                  ? 'bg-white text-slate-800 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calendar className="h-4 w-4 text-indigo-500" />
              Agenda Semanal
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition select-none cursor-pointer ${
                activeTab === 'list' 
                  ? 'bg-white text-slate-800 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Pill className="h-4 w-4 text-emerald-500" />
              Ver Medicamentos ({medications.length})
            </button>
          </div>

          <button 
            onClick={handleOpenAddForm}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-extrabold rounded-xl shadow-xs transition select-none cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Medicamento
          </button>
        </div>

        {/* Outer Contents viewports */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-slate-50">
          
          {/* Tab 1: WEEKLY AGENDA */}
          {activeTab === 'agenda' && (
            <div className="space-y-4">
              {/* Pagination controls for current week of view */}
              <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs">
                <button
                  onClick={() => setWeekOffset(prev => prev - 1)}
                  className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[11px] font-black uppercase flex items-center gap-1 border border-slate-200 transition cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Voltar
                </button>
                <div className="text-center">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block">
                    {weekOffset === 0 ? 'Esta Semana' : weekOffset === 1 ? 'Próxima Semana' : weekOffset === -1 ? 'Semana Passada' : `Deslocamento: ${weekOffset} sem.`}
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {currentWeekDays[0].formattedDate} até {currentWeekDays[6].formattedDate}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {weekOffset !== 0 && (
                    <button
                      onClick={() => setWeekOffset(0)}
                      className="text-[9px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 px-2 py-1.5 rounded-lg border border-rose-200/40 transition cursor-pointer"
                    >
                      Voltar ao Hoje
                    </button>
                  )}
                  <button
                    onClick={() => setWeekOffset(prev => prev + 1)}
                    className="p-1 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[11px] font-black uppercase flex items-center gap-1 border border-slate-200 transition cursor-pointer"
                  >
                    Avançar
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {medications.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 text-center border border-slate-150/40 flex flex-col items-center justify-center space-y-3">
                  <div className="bg-amber-50 p-4 rounded-full border border-amber-100">
                    <CalendarClock className="h-10 w-10 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-700 text-sm">Sem medicações cadastradas ainda</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed max-w-sm font-semibold mt-1">
                      Cadastre os medicamentos de uso contínuo (recorrentes) e corriqueiros (temporários) para montar a rotina clínica semanal.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenAddForm}
                    className="px-5 py-2 text-xs font-black bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> Cadastrar Meu Primeiro Medicamento
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                  {currentWeekDays.map((day) => {
                    const dayMedications = getMedicationsForDay(day.dateStr, day.dayAbbr);
                    
                    return (
                      <div 
                        key={day.dateStr}
                        className={`bg-white rounded-2xl border transition duration-150 overflow-hidden flex flex-col ${
                          day.isToday 
                            ? 'border-indigo-400 ring-2 ring-indigo-50 shadow-md' 
                            : 'border-slate-150/50 shadow-xs'
                        }`}
                      >
                        {/* Day indicator card header */}
                        <div className={`p-3 text-center border-b border-slate-50 flex flex-row md:flex-col justify-between items-center ${
                          day.isToday ? 'bg-indigo-50/40' : 'bg-slate-50/50'
                        }`}>
                          <span className={`text-[11px] font-black uppercase tracking-wider block ${
                            day.isToday ? 'text-indigo-700' : 'text-slate-600'
                          }`}>
                            {day.dayName.split('-')[0]}
                          </span>
                          <span className={`text-xs font-bold md:mt-0.5 block ${
                            day.isToday ? 'text-indigo-950 font-black' : 'text-slate-400'
                          }`}>
                            {day.formattedDate}
                          </span>
                        </div>

                        {/* List items block */}
                        <div className="flex-1 p-2.5 space-y-2 min-h-[140px] md:min-h-[220px]">
                          {dayMedications.length === 0 ? (
                            <div className="h-full flex items-center justify-center p-2">
                              <span className="text-[10px] text-slate-300 italic font-medium leading-tight text-center">
                                Sem doses agendadas
                              </span>
                            </div>
                          ) : (
                            dayMedications.map((item, idx) => (
                              <div 
                                key={`${item.id}-${item.time}-${idx}`}
                                className={`p-2 rounded-xl text-left border ${
                                  item.type === 'temporary' 
                                    ? 'bg-amber-50/55 border-amber-200/50 hover:bg-amber-50' 
                                    : 'bg-slate-50 border-slate-100 hover:bg-slate-100/60'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400">
                                  <span className="text-slate-700 flex items-center gap-0.5">
                                    <Clock className="h-3 w-3 text-indigo-500" />
                                    {item.time}
                                  </span>
                                  {item.type === 'temporary' ? (
                                    <span className="text-[8px] bg-amber-100/70 text-amber-800 font-extrabold uppercase px-1 rounded-sm leading-none shrink-0" title="Medicação Temporária">
                                      Temp
                                    </span>
                                  ) : (
                                    <span className="text-[8px] bg-emerald-100/65 text-emerald-800 font-extrabold uppercase px-1 rounded-sm leading-none shrink-0" title="Medicação Uso Contínuo">
                                      Uso Cont.
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-black text-slate-800 mt-1 truncate" title={item.name}>
                                  {item.name}
                                </div>
                                <div className="text-[10px] text-slate-500 font-bold truncate mt-0.5">
                                  Qtd: {item.dosage}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: LIST OF MEDICATIONS */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
                <Info className="h-5 w-5 text-indigo-500 shrink-0" />
                <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                  Gerencie todo o arsenal terapêutico cadastrado. As alterações afetarão automaticamente a visualização da agenda e os lembretes nos dias correspondentes.
                </p>
              </div>

              {medications.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-150/40 flex flex-col items-center justify-center space-y-3">
                  <Pill className="h-10 w-10 text-slate-300" />
                  <div>
                    <h4 className="font-extrabold text-slate-700 text-sm">Nenhum medicamento registrado</h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed max-w-xs font-semibold mt-1">
                      Crie um cadastro completo de medicamentos e seus horários para facilitar o acompanhamento clínico.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenAddForm}
                    className="px-5 py-2 text-xs font-black bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> Adicionar Medicamento
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {medications.map((med) => (
                    <div 
                      key={med.id} 
                      className="bg-white p-5 rounded-2xl border border-slate-150/55 shadow-xs flex justify-between gap-4 hover:border-slate-300 transition duration-150"
                    >
                      <div className="space-y-2.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-slate-800 text-sm truncate max-w-[200px]">{med.name}</h4>
                          {med.type === 'recurrent' ? (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-extrabold px-1.5 py-0.5 rounded-md">
                              Uso Contínuo
                            </span>
                          ) : (
                            <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 font-extrabold px-1.5 py-0.5 rounded-md">
                              Temporário
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                          <span className="text-slate-400">Dosagem/Quantidade:</span>
                          <strong>{med.dosage}</strong>
                        </div>

                        <div className="text-[11px] font-bold text-slate-600 flex items-start gap-1 flex-wrap">
                          <span className="text-slate-400 mt-0.5 shrink-0">Horários estabelecidos:</span>
                          <div className="flex flex-wrap gap-1">
                            {med.times.map(t => (
                              <span key={t} className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-sm flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5 text-indigo-400" />
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        {med.type === 'recurrent' ? (
                          <div className="text-[11px] font-bold text-slate-600 flex items-start gap-1 flex-wrap">
                            <span className="text-slate-400 shrink-0">Dias de repetição:</span>
                            <div className="flex gap-0.5 text-[8px] font-extrabold">
                              {WEEKDAYS_MAP.map(day => {
                                const isSelected = med.recurrenceDays.includes(day.abbr);
                                return (
                                  <span 
                                    key={day.abbr} 
                                    className={`px-1 py-0.5 rounded-xs tracking-tight ${
                                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                                    }`}
                                  >
                                    {day.label}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                            <span className="text-slate-400">Período ativo:</span>
                            <span className="text-amber-800">
                              {med.startDate?.split('-').reverse().join('/')} até {med.endDate ? med.endDate.split('-').reverse().join('/') : 'indeterminado'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center justify-between shrink-0 border-l border-slate-50 pl-4 space-y-4">
                        <button
                          type="button"
                          onClick={() => handleOpenEditForm(med)}
                          className="p-2 hover:bg-slate-100 hover:text-slate-800 text-slate-400 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-[10px] font-black uppercase"
                          title="Editar medicamento"
                        >
                          <Edit2 className="h-4 w-4 text-indigo-500" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => med.id && handleDelete(med.id, med.name)}
                          className="p-2 hover:bg-rose-50 hover:text-rose-700 text-slate-400 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-[10px] font-black uppercase"
                          title="Remover medicamento"
                        >
                          <Trash2 className="h-4 w-4 text-rose-500" />
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal-on-Modal view of adding/editing form */}
        <AnimatePresence>
          {showForm && (
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-150 flex flex-col max-h-[90%]"
              >
                {/* Form Header */}
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-indigo-500" />
                    {editingMed ? `Editar Cadastro: ${editingMed.name}` : 'Cadastrar Novo Medicamento'}
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Form Elements */}
                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4 text-left">
                  {errorMessage && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex gap-2 items-center text-xs">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span className="font-semibold leading-relaxed">{errorMessage}</span>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">Nome do Medicamento</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Ex: Depakene, Frisium, Sabril..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-400 text-xs font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">Dosagem e Medida</label>
                    <input 
                      type="text" 
                      value={dosage}
                      onChange={e => setDosage(e.target.value)}
                      placeholder="Ex: 10 gotas, 1 comprimido, 5ml..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:border-indigo-400 text-xs font-bold text-slate-800"
                    />
                  </div>

                  {/* Times List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">Horários de Administração</label>
                      <button 
                        type="button" 
                        onClick={handleAddTimeField}
                        className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> Adicionar Horário
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {times.map((time, idx) => (
                        <div key={idx} className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1 px-2.5">
                          <Clock className="h-3.5 w-3.5 text-indigo-400" />
                          <input 
                            type="time" 
                            value={time}
                            onChange={(e) => handleUpdateTimeField(idx, e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none select-none border-none py-1.5 px-0.5"
                          />
                          {times.length > 1 && (
                            <button 
                              type="button" 
                              onClick={() => handleRemoveTimeField(idx)}
                              className="text-rose-500 hover:text-rose-700 p-0.5 ml-1 rounded-sm cursor-pointer hover:bg-rose-50"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Frequency Profile */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">Frequência/Recorrência</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setType('recurrent')}
                        className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                          type === 'recurrent'
                            ? 'bg-indigo-50/70 border-indigo-400 text-indigo-900 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Clock className="h-4 w-4 mb-1" />
                        <span className="text-[10px] font-extrabold uppercase">Uso Contínuo</span>
                        <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Toda semana sem falta</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setType('temporary')}
                        className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center cursor-pointer ${
                          type === 'temporary'
                            ? 'bg-amber-50/70 border-amber-400 text-amber-900 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <CalendarClock className="h-4 w-4 mb-1" />
                        <span className="text-[10px] font-extrabold uppercase">Temporário</span>
                        <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Apenas por um período</span>
                      </button>
                    </div>
                  </div>

                  {/* Conditional Recurrence Weekdays selection details */}
                  {type === 'recurrent' && (
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Dias de administração</span>
                        <button 
                          type="button"
                          onClick={() => setRecurrenceDays(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'])}
                          className="text-[9px] font-bold text-slate-400 hover:text-indigo-600 underline cursor-pointer"
                        >
                          Selecionar Todos os Dias
                        </button>
                      </div>
                      <div className="flex justify-between gap-1.5">
                        {WEEKDAYS_MAP.map((day) => {
                          const isSelected = recurrenceDays.includes(day.abbr);
                          return (
                            <button
                              type="button"
                              key={day.abbr}
                              onClick={() => handleToggleRecurrenceDay(day.abbr)}
                              className={`flex-1 text-center py-2 text-[10px] font-extrabold uppercase rounded-lg border transition select-none cursor-pointer ${
                                isSelected 
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Conditional Temporary Period fields */}
                  {type === 'temporary' && (
                    <div className="bg-amber-50/45 p-3.5 rounded-2xl border border-amber-200/40 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-amber-900">Data de Início</label>
                        <input 
                          type="date" 
                          value={startDate}
                          onChange={e => setStartDate(e.target.value)}
                          className="w-full bg-white border border-amber-100 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none text-center cursor-pointer"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-amber-900">Data de Fim (opcional)</label>
                        <input 
                          type="date" 
                          value={endDate}
                          onChange={e => setEndDate(e.target.value)}
                          placeholder="Indeterminado"
                          className="w-full bg-white border border-amber-100 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none text-center cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  {/* Form Footer */}
                  <div className="pt-3 border-t border-slate-100 flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-500 font-bold text-xs rounded-xl transition cursor-pointer select-none text-center"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer select-none text-center"
                    >
                      {isSaving ? 'Salvando...' : 'Confirmar e Salvar'}
                    </button>
                  </div>

                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}
