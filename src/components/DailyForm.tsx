import { calculateSleepDuration } from '../utils';
import { DailyLog, SeizureTimingCounts, SleepStatus } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { 
  X, Moon, ShieldAlert, BadgeInfo, Check, Plus, Minus, Info, Clipboard, Activity 
} from 'lucide-react';

interface DailyFormProps {
  initialDate?: string;
  onSave: (log: Partial<DailyLog>) => Promise<void>;
  onClose: () => void;
  existingLog?: DailyLog | null;
}

const TRIGGER_CHIPS = [
  'Febre', 'Calor Excessivo', 'Estresse/Choro', 'Privação de Sono', 
  'Luz Piscante/Telas', 'Dentição', 'Cansaço Físico', 'Mudança Climática'
];

export default function DailyForm({ initialDate, onSave, onClose, existingLog }: DailyFormProps) {
  // Date setup
  const dateStr = initialDate || new Date().toISOString().split('T')[0];

  // Forms state
  const [sleepStatus, setSleepStatus] = useState<SleepStatus>('dormiu');
  const [sleepTime, setSleepTime] = useState<string>('21:00');
  const [wakeTime, setWakeTime] = useState<string>('07:00');
  const [sleepQuality, setSleepQuality] = useState<number>(4);
  const [wakeUpCount, setWakeUpCount] = useState<number>(0);
  const [sleepObs, setSleepObs] = useState<string>('');

  // Seizures status
  const [seizuresOccurred, setSeizuresOccurred] = useState<boolean>(false);
  
  // Morning counts details
  const [morningDet, setMorningDet] = useState<SeizureTimingCounts>({ light: 0, medium: 0, strong: 0 });
  // Afternoon counts details
  const [afternoonDet, setAfternoonDet] = useState<SeizureTimingCounts>({ light: 0, medium: 0, strong: 0 });
  // Night counts details
  const [nightDet, setNightDet] = useState<SeizureTimingCounts>({ light: 0, medium: 0, strong: 0 });

  // Triggers and Observations
  const [seizureTriggers, setSeizureTriggers] = useState<string>('');
  const [seizureObs, setSeizureObs] = useState<string>('');

  // Medication status
  const [medicationTaken, setMedicationTaken] = useState<boolean>(true);
  const [medicationObs, setMedicationObs] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1); // Step-by-step assistant

  // Hydrate form if editing
  useEffect(() => {
    if (existingLog) {
      setSleepStatus(existingLog.sleep.status);
      setSleepTime(existingLog.sleep.sleepTime || '21:00');
      setWakeTime(existingLog.sleep.wakeTime || '07:00');
      setSleepQuality(existingLog.sleep.quality);
      setWakeUpCount(existingLog.sleep.wakeUpCount);
      setSleepObs(existingLog.sleep.observations || '');

      setSeizuresOccurred(existingLog.seizures.occurred);
      setMorningDet(existingLog.seizures.morningDetails || { light: 0, medium: 0, strong: 0 });
      setAfternoonDet(existingLog.seizures.afternoonDetails || { light: 0, medium: 0, strong: 0 });
      setNightDet(existingLog.seizures.nightDetails || { light: 0, medium: 0, strong: 0 });
      setSeizureTriggers(existingLog.seizures.triggers || '');
      setSeizureObs(existingLog.seizures.observations || '');

      setMedicationTaken(existingLog.medication.taken);
      setMedicationObs(existingLog.medication.observations || '');
    }
  }, [existingLog]);

  // Live total sum calculations
  const totalMorning = morningDet.light + morningDet.medium + morningDet.strong;
  const totalAfternoon = afternoonDet.light + afternoonDet.medium + afternoonDet.strong;
  const totalNight = nightDet.light + nightDet.medium + nightDet.strong;
  const totalSeizuresSum = totalMorning + totalAfternoon + totalNight;

  // Sync occurred switch based on manual counts too
  useEffect(() => {
    if (totalSeizuresSum > 0) {
      setSeizuresOccurred(true);
    }
  }, [totalSeizuresSum]);

  const hoursSlept = calculateSleepDuration(sleepTime, wakeTime);

  // Segment adjustment handlers
  const handleModifyCount = (
    segment: 'morning' | 'afternoon' | 'night',
    severity: keyof SeizureTimingCounts,
    delta: number
  ) => {
    const setterMap = {
      morning: { state: morningDet, set: setMorningDet },
      afternoon: { state: afternoonDet, set: setAfternoonDet },
      night: { state: nightDet, set: setNightDet }
    };

    const target = setterMap[segment];
    const prevValue = target.state[severity];
    const newValue = Math.max(0, prevValue + delta);
    
    target.set({
      ...target.state,
      [severity]: newValue
    });
  };

  const toggleTriggerChip = (chip: string) => {
    const currentTriggers = seizureTriggers ? seizureTriggers.split(',').map(t => t.trim()) : [];
    if (currentTriggers.includes(chip)) {
      setSeizureTriggers(currentTriggers.filter(t => t !== chip).join(', '));
    } else {
      currentTriggers.push(chip);
      setSeizureTriggers(currentTriggers.filter(Boolean).join(', '));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const partialLog: Partial<DailyLog> = {
      date: dateStr,
      sleep: {
        status: sleepStatus,
        sleepTime,
        wakeTime,
        hoursSlept,
        quality: sleepQuality,
        wakeUpCount,
        observations: sleepObs
      },
      seizures: {
        occurred: seizuresOccurred,
        morningCount: totalMorning,
        afternoonCount: totalAfternoon,
        nightCount: totalNight,
        morningDetails: morningDet,
        afternoonDetails: afternoonDet,
        nightDetails: nightDet,
        totalCount: seizuresOccurred ? totalSeizuresSum : 0,
        triggers: seizureTriggers,
        observations: seizureObs
      },
      medication: {
        taken: medicationTaken,
        observations: medicationObs
      }
    };

    try {
      await onSave(partialLog);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto" id="daily-form-modal">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col my-8 border border-slate-100"
      >
        {/* Header wrapper */}
        <div className="bg-rose-500 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs bg-white/20 px-2.5 py-0.5 rounded-full font-mono">
              {dateStr.split('-').reverse().join('/')}
            </span>
            <h2 className="text-lg font-bold mt-1">
              {existingLog ? 'Editar Registro Diário' : 'Como foi o dia de hoje?'}
            </h2>
          </div>
          <button 
            id="close-daily-form"
            onClick={onClose} 
            className="p-1.5 hover:bg-white/20 rounded-full transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step dots */}
        <div className="flex bg-slate-50 border-b border-slate-100 px-6 py-2 justify-between items-center text-xs">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((step) => (
              <span 
                key={step} 
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentStep === step 
                    ? 'w-6 bg-rose-500' 
                    : step < currentStep 
                    ? 'w-2 bg-emerald-500' 
                    : 'w-2 bg-slate-300'
                }`}
              />
            ))}
          </div>
          <span className="text-slate-500 font-medium">Passo {currentStep} de 3</span>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto max-h-[70vh] p-6 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* STEP 1: SLEEP METRICS */}
            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Moon className="h-5 w-5 text-indigo-500" />
                  <h3 className="font-bold text-slate-700">Qualidade e Parâmetros de Sono</h3>
                </div>

                {/* Sleep status query */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Como foi o sono da criança?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'dormiu', label: 'Dormiu bem' },
                      { id: 'não dormiu', label: 'Não dormiu' },
                      { id: 'dormiu tarde', label: 'Dormiu tarde' }
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        id={`sleep-status-${item.id}`}
                        onClick={() => setSleepStatus(item.id as SleepStatus)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-semibold text-center border transition-all cursor-pointer select-none ${
                          sleepStatus === item.id
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {sleepStatus !== 'não dormiu' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-1"
                  >
                    {/* Time fields with auto count calculation */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Hora que dormiu</label>
                        <input
                          type="time"
                          value={sleepTime}
                          onChange={(e) => setSleepTime(e.target.value)}
                          className="w-full bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Hora que acordou</label>
                        <input
                          type="time"
                          value={wakeTime}
                          onChange={(e) => setWakeTime(e.target.value)}
                          className="w-full bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 p-2.5 outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>

                    {/* Calculated hours sleeps box */}
                    <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-indigo-700 font-medium">
                        <Info className="h-4 w-4" />
                        <span>Duração calculada:</span>
                      </div>
                      <span className="font-bold text-indigo-800 text-sm">{hoursSlept} {hoursSlept === 1 ? 'hora' : 'horas'}</span>
                    </div>

                    {/* Quality rating (1 to 5 stars) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Qualidade do sono (1 a 5 estrelas)</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((stars) => (
                          <button
                            type="button"
                            key={stars}
                            onClick={() => setSleepQuality(stars)}
                            className={`p-2 rounded-lg text-lg font-bold transition flex-1 border text-center cursor-pointer ${
                              sleepQuality >= stars
                                ? 'bg-amber-100/60 border-amber-300 text-amber-700 shadow-sm'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          >
                            {stars} ⭐
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Wake ups */}
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Frequência: Quantas vezes acordou à noite?</label>
                      <div className="flex items-center gap-3 bg-slate-50 rounded-xl border border-slate-200 p-1 w-36">
                        <button
                          type="button"
                          onClick={() => setWakeUpCount(Math.max(0, wakeUpCount - 1))}
                          className="p-1.5 hover:bg-white rounded-lg transition active:scale-95 cursor-pointer text-slate-600"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="flex-1 text-center font-bold text-slate-800 text-sm">{wakeUpCount}</span>
                        <button
                          type="button"
                          onClick={() => setWakeUpCount(wakeUpCount + 1)}
                          className="p-1.5 hover:bg-white rounded-lg transition active:scale-95 cursor-pointer text-slate-600"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Sleep Obs text field */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Observações do sono</label>
                  <textarea
                    placeholder="Ex: Teve pesadelos, agitação, pernas mexendo muito..."
                    value={sleepObs}
                    onChange={(e) => setSleepObs(e.target.value)}
                    rows={2}
                    className="w-full text-sm bg-slate-50 text-slate-700 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-400 resize-none font-sans"
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 2: CONVULSIVE SEIZURE SEGMENTATION */}
            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <ShieldAlert className="h-5 w-5 text-rose-500" />
                  <h3 className="font-bold text-slate-700">Seção de Crises Convulsivas</h3>
                </div>

                {/* Did general seizure occur today? */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-slate-700 block">Teve crise convulsiva hoje?</span>
                    <span className="text-xs text-slate-400">Informe se ocorreu algum episódio clínico.</span>
                  </div>
                  <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setSeizuresOccurred(true);
                      }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                        seizuresOccurred
                          ? 'bg-rose-500 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSeizuresOccurred(false);
                        // Reset segmented counts since none occurred
                        setMorningDet({ light: 0, medium: 0, strong: 0 });
                        setAfternoonDet({ light: 0, medium: 0, strong: 0 });
                        setNightDet({ light: 0, medium: 0, strong: 0 });
                      }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                        !seizuresOccurred
                          ? 'bg-slate-500 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Não
                    </button>
                  </div>
                </div>

                {/* Segments configuration detailed panels */}
                <AnimatePresence>
                  {seizuresOccurred && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-5 overflow-hidden"
                    >
                      {/* Live Counter Sum Display */}
                      <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 flex items-center justify-between text-xs">
                        <span className="text-rose-800 font-bold flex items-center gap-1.5">
                          <Activity className="h-4 w-4" /> Somatória total de crises hoje:
                        </span>
                        <span className="bg-rose-500 text-white font-extrabold text-sm px-2.5 py-0.5 rounded-md shadow-sm">
                          {totalSeizuresSum}
                        </span>
                      </div>

                      {/* Segmentation Wizard tables for Morning, Afternoon, Night vs Severity */}
                      {[
                        { key: 'morning', label: 'Manhã (06:00 - 12:00)', state: morningDet, total: totalMorning },
                        { key: 'afternoon', label: 'Tarde (12:00 - 18:00)', state: afternoonDet, total: totalAfternoon },
                        { key: 'night', label: 'Noite / Madrugada (18:00 - 06:00)', state: nightDet, total: totalNight }
                      ].map((period) => (
                        <div key={period.key} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-50 pb-1.5">
                            <span className="font-bold text-xs text-slate-700">{period.label}</span>
                            <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-md">Total: {period.total}</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            {/* Light counts */}
                            <div className="bg-emerald-50/40 p-2 rounded-xl text-center border border-emerald-100/50 flex flex-col items-center">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Leve</span>
                              <span className="text-lg font-extrabold text-emerald-800 my-1">{period.state.light}</span>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleModifyCount(period.key as any, 'light', -1)}
                                  className="p-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-xs active:scale-90 cursor-pointer"
                                >
                                  <Minus className="h-3.5 w-3.5 text-slate-500" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleModifyCount(period.key as any, 'light', 1)}
                                  className="p-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-xs active:scale-90 cursor-pointer"
                                >
                                  <Plus className="h-3.5 w-3.5 text-slate-500" />
                                </button>
                              </div>
                            </div>

                            {/* Medium counts */}
                            <div className="bg-amber-50/40 p-2 rounded-xl text-center border border-amber-100/50 flex flex-col items-center">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Média</span>
                              <span className="text-lg font-extrabold text-amber-800 my-1">{period.state.medium}</span>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleModifyCount(period.key as any, 'medium', -1)}
                                  className="p-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-xs active:scale-90 cursor-pointer"
                                >
                                  <Minus className="h-3.5 w-3.5 text-slate-500" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleModifyCount(period.key as any, 'medium', 1)}
                                  className="p-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-xs active:scale-90 cursor-pointer"
                                >
                                  <Plus className="h-3.5 w-3.5 text-slate-500" />
                                </button>
                              </div>
                            </div>

                            {/* Strong counts */}
                            <div className="bg-rose-50/40 p-2 rounded-xl text-center border border-rose-100/50 flex flex-col items-center">
                              <span className="text-[10px] font-bold text-slate-500 uppercase">Forte</span>
                              <span className="text-lg font-extrabold text-rose-800 my-1">{period.state.strong}</span>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleModifyCount(period.key as any, 'strong', -1)}
                                  className="p-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-xs active:scale-90 cursor-pointer"
                                >
                                  <Minus className="h-3.5 w-3.5 text-slate-500" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleModifyCount(period.key as any, 'strong', 1)}
                                  className="p-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md shadow-xs active:scale-90 cursor-pointer"
                                >
                                  <Plus className="h-3.5 w-3.5 text-slate-500" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Triggers configuration */}
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                          Gatilhos identificados para crises:
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                          {TRIGGER_CHIPS.map(chip => {
                            const isSelected = seizureTriggers.split(',').map(t => t.trim()).includes(chip);
                            return (
                              <button
                                type="button"
                                key={chip}
                                onClick={() => toggleTriggerChip(chip)}
                                className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border transition cursor-pointer select-none ${
                                  isSelected 
                                    ? 'bg-rose-50 border-rose-400 text-rose-700 shadow-xs' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                {chip}
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="text"
                          value={seizureTriggers}
                          onChange={(e) => setSeizureTriggers(e.target.value)}
                          placeholder="Digite outros gatilhos separados por vírgula..."
                          className="w-full text-sm bg-slate-50 text-slate-700 border border-slate-200 p-2.5 rounded-xl outline-none focus:border-rose-400"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Seizures observation */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">
                    {seizuresOccurred ? 'Observação sobre o comportamento ou duração das crises' : 'Observação geral do dia / bem-estar'}
                  </label>
                  <textarea
                    placeholder="Ex: Teve desmaio breve de 30s, espasmo leve na perna esquerda. Acordou chorando muito..."
                    value={seizureObs}
                    onChange={(e) => setSeizureObs(e.target.value)}
                    rows={2}
                    className="w-full text-sm bg-slate-50 text-slate-700 border border-slate-200 rounded-xl p-3 outline-none focus:border-rose-400 resize-none font-sans"
                  />
                </div>
              </motion.div>
            )}

            {/* STEP 3: MEDICATION AND RECAP */}
            {currentStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Clipboard className="h-5 w-5 text-indigo-500" />
                  <h3 className="font-bold text-slate-700">Controle de Medicação e Resumo</h3>
                </div>

                {/* Medication boolean indicator */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-slate-700 block">Tomou a medicação certinha de hoje?</span>
                    <span className="text-xs text-slate-400">Marque se os remédios habituais foram dados.</span>
                  </div>
                  <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setMedicationTaken(true)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                        medicationTaken
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Sim
                    </button>
                    <button
                      type="button"
                      onClick={() => setMedicationTaken(false)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                        !medicationTaken
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Não
                    </button>
                  </div>
                </div>

                {/* Medication comments text field */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Observações da Medicação</label>
                  <textarea
                    placeholder="Ex: Teve alteração de dosagem do Depakene ou recusa ao tomar..."
                    value={medicationObs}
                    onChange={(e) => setMedicationObs(e.target.value)}
                    rows={2}
                    className="w-full text-sm bg-slate-50 text-slate-700 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-400 resize-none font-sans"
                  />
                </div>

                {/* Recap review section */}
                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-2.5">
                  <p className="font-bold text-slate-700 border-b border-slate-100 pb-1.5 mb-2 uppercase text-[10px] tracking-wider">
                    RECAPITULAÇÃO DO REGISTRO:
                  </p>
                  <div className="flex justify-between">
                    <span>📋 Data do diário:</span>
                    <span className="font-bold text-slate-800">{dateStr.split('-').reverse().join('/')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🌙 Parâmetro de Sono:</span>
                    <span className="font-bold text-slate-800 uppercase text-[11px]">{sleepStatus} {sleepStatus !== 'não dormiu' ? `(${hoursSlept}h)` : ''}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>⭐ Qualidade de Sono:</span>
                    <span className="font-bold text-slate-800">{sleepStatus !== 'não dormiu' ? `${sleepQuality} / 5` : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>⚡ Crises convulsivas:</span>
                    <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${seizuresOccurred ? 'bg-rose-100 text-rose-800' : 'bg-green-100 text-green-800'}`}>
                      {seizuresOccurred ? `${totalSeizuresSum} crises registradas` : 'Nenhuma crise'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>💊 Medicação tomada:</span>
                    <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${medicationTaken ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'}`}>
                      {medicationTaken ? 'Sim, completa' : 'Não administrada'}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </form>

        {/* Buttons drawer */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex gap-3 justify-between items-center">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                id="btn-prev-step"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 font-medium text-xs shadow-xs transition select-none cursor-pointer"
              >
                Voltar
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {currentStep < 3 ? (
              <button
                type="button"
                id="btn-next-step"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-xs shadow-sm transition select-none cursor-pointer"
              >
                Avançar
              </button>
            ) : (
              <button
                type="button"
                id="btn-save-log"
                onClick={handleFormSubmit}
                disabled={saving}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                    Gravando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Finalizar Registro
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
