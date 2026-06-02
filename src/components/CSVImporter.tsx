import { parseCSV, generateCSVTemplateString, calculateSleepDuration } from '../utils';
import { DailyLog, SleepStatus, SeizureTimingCounts } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, CheckCircle, FileSpreadsheet, Download, RefreshCw, AlertTriangle, Play, Check, ChevronRight, HelpCircle 
} from 'lucide-react';

interface CSVImporterProps {
  onImportComplete: (logs: Partial<DailyLog>[]) => Promise<void>;
  onClose: () => void;
}

interface ColumnMapping {
  date: string;
  sleepStatus: string;
  sleepTime: string;
  wakeTime: string;
  sleepQuality: string;
  wakeUpCount: string;
  sleepObs: string;
  seizuresOccurred: string;
  seizureMorning: string;
  seizureAfternoon: string;
  seizureNight: string;
  seizureTriggers: string;
  seizureObs: string;
  medicationTaken: string;
  medicationObs: string;
}

const normalizeString = (str: string): string => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const cleanDate = (val: any): string | null => {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(val).trim();
  if (!str) return null;

  // Se for número serial do Excel (ex: 45102)
  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Se for no formato DD/MM/AAAA ou DD-MM-AAAA
  const parts = str.split(/[/\-.]/);
  if (parts.length === 3) {
    let d = parts[0].trim();
    let m = parts[1].trim();
    let y = parts[2].trim();

    // Se o primeiro segmento tiver tamanho 4, assume que já é AAAA-MM-DD
    if (d.length === 4) {
      y = parts[0].trim();
      m = parts[1].trim();
      d = parts[2].trim();
    }

    d = d.padStart(2, '0');
    m = m.padStart(2, '0');

    if (y.length === 2) {
      y = parseInt(y, 10) > 50 ? '19' + y : '20' + y;
    }

    if (y.length === 4 && d.length === 2 && m.length === 2) {
      const yearNum = parseInt(y, 10);
      const monthNum = parseInt(m, 10) - 1;
      const dayNum = parseInt(d, 10);
      const test = new Date(yearNum, monthNum, dayNum);
      if (test.getFullYear() === yearNum && test.getMonth() === monthNum && test.getDate() === dayNum) {
        return `${y}-${m}-${d}`;
      }
    }
  }

  // Fallback padrão Date parse do JS
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime())) {
    const y = parsedDate.getFullYear();
    const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const d = String(parsedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
};

const cleanTime = (val: any, defaultTime: string): string => {
  if (val === null || val === undefined) return defaultTime;

  const num = Number(val);
  if (!isNaN(num) && num >= 0 && num <= 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const str = String(val).trim().toUpperCase();
  if (!str) return defaultTime;

  let cleaned = str
    .replace(/[Hh]/g, ':')
    .replace(/[Mm]/g, '')
    .replace(/[^0-9:AMP\s.]/g, '')
    .trim();

  const isPM = cleaned.includes('PM');
  const isAM = cleaned.includes('AM');
  cleaned = cleaned.replace(/AM|PM/g, '').trim();

  if (!cleaned.includes(':') && cleaned.includes('.')) {
    cleaned = cleaned.replace('.', ':');
  }

  if (!cleaned.includes(':')) {
    if (cleaned.length === 1 || cleaned.length === 2) {
      cleaned = cleaned.padStart(2, '0') + ':00';
    } else if (cleaned.length === 3) {
      cleaned = '0' + cleaned.substring(0, 1) + ':' + cleaned.substring(1);
    } else if (cleaned.length === 4) {
      cleaned = cleaned.substring(0, 2) + ':' + cleaned.substring(2);
    }
  }

  const parts = cleaned.split(':');
  if (parts.length >= 2) {
    let hour = parseInt(parts[0], 10);
    let min = parseInt(parts[1], 10);

    if (!isNaN(hour) && !isNaN(min)) {
      if (isPM && hour < 12) hour += 12;
      if (isAM && hour === 12) hour = 0;

      hour = Math.max(0, Math.min(23, hour));
      min = Math.max(0, Math.min(59, min));

      return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }

  return defaultTime;
};

const cleanNumber = (val: any, defaultVal: number): number => {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;

  const str = String(val).trim();
  if (!str) return defaultVal;

  const cleaned = str.replace(',', '.');
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (match) {
    const num = parseFloat(match[0]);
    return isNaN(num) ? defaultVal : num;
  }
  return defaultVal;
};

const cleanBoolean = (val: any): boolean => {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;

  const str = normalizeString(String(val));
  const trueTokens = ['sim', 's', 'yes', 'y', 'teve', 'ocorreu', '1', 'true', 'ativo', 'positivo', 'checked'];
  return trueTokens.some(token => str.includes(token)) || Number(str) > 0;
};

const autoMatchHeaders = (headers: string[]): ColumnMapping => {
  const newMapping: ColumnMapping = {
    date: '',
    sleepStatus: '',
    sleepTime: '',
    wakeTime: '',
    sleepQuality: '',
    wakeUpCount: '',
    sleepObs: '',
    seizuresOccurred: '',
    seizureMorning: '',
    seizureAfternoon: '',
    seizureNight: '',
    seizureTriggers: '',
    seizureObs: '',
    medicationTaken: '',
    medicationObs: ''
  };

  headers.forEach((header) => {
    const hNorm = normalizeString(header);
    
    if (hNorm === 'data' || hNorm.includes('data do') || hNorm.includes('data_res') || hNorm.includes('dia') || hNorm.includes('data (')) {
      newMapping.date = header;
    } else if (hNorm.includes('status') || hNorm.includes('dormiu') || hNorm.includes('sono_status')) {
      newMapping.sleepStatus = header;
    } else if (hNorm.includes('horario dorm') || hNorm.includes('sono dorm') || hNorm.includes('sleep time') || hNorm.includes('hora_dorm') || hNorm.includes('horario_dorm') || hNorm.includes('dormir')) {
      newMapping.sleepTime = header;
    } else if (hNorm.includes('horario acord') || hNorm.includes('sono acord') || hNorm.includes('wake time') || hNorm.includes('hora_acord') || hNorm.includes('horario_acord') || hNorm.includes('acordar') || hNorm.includes('despertar')) {
      newMapping.wakeTime = header;
    } else if (hNorm.includes('qualidade') || hNorm.includes('nota') || hNorm.includes('quality') || hNorm.includes('aproveitamento')) {
      newMapping.sleepQuality = header;
    } else if (hNorm.includes('vezes') || hNorm.includes('acordou no') || hNorm.includes('awakenings') || hNorm.includes('despertares') || hNorm.includes('acordou')) {
      newMapping.wakeUpCount = header;
    } else if (hNorm.includes('obs') && (hNorm.includes('sono') || hNorm.includes('dormir'))) {
      newMapping.sleepObs = header;
    } else if (hNorm.includes('teve crise') || hNorm.includes('crise?') || hNorm.includes('ocorreu') || (hNorm.includes('crise') && !hNorm.includes('obs') && !hNorm.includes('gatilho') && !hNorm.includes('manha') && !hNorm.includes('tarde') && !hNorm.includes('noite'))) {
      newMapping.seizuresOccurred = header;
    } else if (hNorm.includes('manha') || hNorm.includes('morning')) {
      newMapping.seizureMorning = header;
    } else if (hNorm.includes('tarde') || hNorm.includes('afternoon')) {
      newMapping.seizureAfternoon = header;
    } else if (hNorm.includes('noite') || hNorm.includes('night') || hNorm.includes('madrugada')) {
      newMapping.seizureNight = header;
    } else if (hNorm.includes('gatilho') || hNorm.includes('trigger')) {
      newMapping.seizureTriggers = header;
    } else if (hNorm.includes('obs') && (hNorm.includes('crise') || hNorm.includes('convul'))) {
      newMapping.seizureObs = header;
    } else if (hNorm.includes('medic') || hNorm.includes('remedio') || hNorm.includes('remedic') || hNorm.includes('medicamento')) {
      newMapping.medicationTaken = header;
    } else if (hNorm.includes('obs') && (hNorm.includes('med') || hNorm.includes('remedio'))) {
      newMapping.medicationObs = header;
    }
  });

  return newMapping;
};

export default function CSVImporter({ onImportComplete, onClose }: CSVImporterProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Select CSV, 2: Map Columns, 3: Review & Upload
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [fileName, setFileName] = useState<string>('');
  
  // Mapping configuration mapping standard fields to upload CSV index/headers
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    sleepStatus: '',
    sleepTime: '',
    wakeTime: '',
    sleepQuality: '',
    wakeUpCount: '',
    sleepObs: '',
    seizuresOccurred: '',
    seizureMorning: '',
    seizureAfternoon: '',
    seizureNight: '',
    seizureTriggers: '',
    seizureObs: '',
    medicationTaken: '',
    medicationObs: ''
  });

  const [parsedLogs, setParsedLogs] = useState<Partial<DailyLog>[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplateString();
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_historico_crises_2023.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setErrorMsg(null);
    setFileName(file.name);
    
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    const reader = new FileReader();
    
    if (isExcel) {
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
          
          if (!workbook.SheetNames.length) {
            throw new Error('O arquivo Excel não contém abas.');
          }
          
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Get sheet as 2D array
          const parsed = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          
          if (parsed.length === 0) {
            throw new Error('A planilha selecionada está vazia.');
          }
          
          // Convert all cells to strings gracefully, formatting dates if any
          const normalizedRows: string[][] = parsed.map((row: any[]) => 
            row.map((cell: any) => {
              if (cell === null || cell === undefined) return '';
              
              if (cell instanceof Date) {
                // Adjust for timezone differences (SheetJS cells with cellDates: true can shift local times)
                const y = cell.getFullYear();
                const m = String(cell.getMonth() + 1).padStart(2, '0');
                const d = String(cell.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
              }
              return String(cell).trim();
            })
          ).filter(row => row.some(cell => cell !== '')); // Skip fully empty rows
          
          if (normalizedRows.length === 0) {
            throw new Error('A planilha selecionada não possui dados legíveis.');
          }
          
          const headers = normalizedRows[0];
          setCsvHeaders(headers);
          setCsvRows(normalizedRows.slice(1));
          
          // Auto-match mapper by content patterns
          setMapping(autoMatchHeaders(headers));
          setStep(2);
        } catch (err: any) {
          setErrorMsg(err.message || 'Falha ao analisar o arquivo Excel. Verifique se o arquivo não está corrompido.');
        }
      };
      
      reader.readAsArrayBuffer(file);
    } else {
      // Normal CSV read
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const parsed = parseCSV(text);
          
          if (parsed.length === 0) {
            throw new Error('O arquivo CSV selecionado está vazio.');
          }
          
          const headers = parsed[0];
          setCsvHeaders(headers);
          setCsvRows(parsed.slice(1));
          
          // Auto-match mapper by content patterns
          setMapping(autoMatchHeaders(headers));
          setStep(2);
        } catch (err: any) {
          setErrorMsg(err.message || 'Falha ao analisar o arquivo. Verifique se é um arquivo CSV válido.');
        }
      };
      
      reader.readAsText(file, 'utf-8');
    }
  };

  const handleUpdateMapping = (field: keyof ColumnMapping, val: string) => {
    setMapping({ ...mapping, [field]: val });
  };

  const handleProcessMappingAndVerify = () => {
    setErrorMsg(null);
    if (!mapping.date) {
      setErrorMsg('A coluna de Data representa a chave principal de identificação e deve ser obrigatoriamente mapeada.');
      return;
    }

    try {
      const logsResult: Partial<DailyLog>[] = [];
      
      const dateIndex = csvHeaders.indexOf(mapping.date);
      const sleepStatusIndex = csvHeaders.indexOf(mapping.sleepStatus);
      const sleepTimeIndex = csvHeaders.indexOf(mapping.sleepTime);
      const wakeTimeIndex = csvHeaders.indexOf(mapping.wakeTime);
      const sleepQualityIndex = csvHeaders.indexOf(mapping.sleepQuality);
      const wakeUpCountIndex = csvHeaders.indexOf(mapping.wakeUpCount);
      const sleepObsIndex = csvHeaders.indexOf(mapping.sleepObs);
      const seizuresOccurredIndex = csvHeaders.indexOf(mapping.seizuresOccurred);
      const seizureMorningIndex = csvHeaders.indexOf(mapping.seizureMorning);
      const seizureAfternoonIndex = csvHeaders.indexOf(mapping.seizureAfternoon);
      const seizureNightIndex = csvHeaders.indexOf(mapping.seizureNight);
      const seizureTriggersIndex = csvHeaders.indexOf(mapping.seizureTriggers);
      const seizureObsIndex = csvHeaders.indexOf(mapping.seizureObs);
      const medicationTakenIndex = csvHeaders.indexOf(mapping.medicationTaken);
      const medicationObsIndex = csvHeaders.indexOf(mapping.medicationObs);

      csvRows.forEach((row, i) => {
        const rawDate = row[dateIndex];
        if (rawDate === null || rawDate === undefined || String(rawDate).trim() === '') return; // Skip empty date rows

        const formattedDate = cleanDate(rawDate);
        if (!formattedDate) {
          console.warn(`Pulei a linha ${i + 1} por possuir uma data inválida: ${rawDate}`);
          return;
        }

        // Sleep parsing
        const rawSleepStatus = sleepStatusIndex !== -1 ? String(row[sleepStatusIndex] || '').toLowerCase() : '';
        let sleepStatus: SleepStatus = 'dormiu';
        if (rawSleepStatus.includes('não') || rawSleepStatus.includes('nao')) sleepStatus = 'não dormiu';
        else if (rawSleepStatus.includes('tarde')) sleepStatus = 'dormiu tarde';

        const sTime = sleepTimeIndex !== -1 ? cleanTime(row[sleepTimeIndex], '21:00') : '21:00';
        const wTime = wakeTimeIndex !== -1 ? cleanTime(row[wakeTimeIndex], '07:00') : '07:00';
        const hoursSlept = calculateSleepDuration(sTime, wTime);

        const qVal = sleepQualityIndex !== -1 ? cleanNumber(row[sleepQualityIndex], 4) : 4;
        const wakeCount = wakeUpCountIndex !== -1 ? cleanNumber(row[wakeUpCountIndex], 0) : 0;

        // Seizures occurrence and counts
        const rawOccurred = seizuresOccurredIndex !== -1 ? row[seizuresOccurredIndex] : '';
        let occurredVal = cleanBoolean(rawOccurred);

        const mornCount = seizureMorningIndex !== -1 ? cleanNumber(row[seizureMorningIndex], 0) : 0;
        const aftCount = seizureAfternoonIndex !== -1 ? cleanNumber(row[seizureAfternoonIndex], 0) : 0;
        const ngtCount = seizureNightIndex !== -1 ? cleanNumber(row[seizureNightIndex], 0) : 0;

        const calculatedSum = mornCount + aftCount + ngtCount;
        if (calculatedSum > 0) occurredVal = true;

        // Medication parsing
        const rawMed = medicationTakenIndex !== -1 ? row[medicationTakenIndex] : '';
        // If not mapped, default medication taken to true
        const medTaken = medicationTakenIndex !== -1 ? cleanBoolean(rawMed) : true;

        const singleLog: Partial<DailyLog> = {
          date: formattedDate,
          sleep: {
            status: sleepStatus,
            sleepTime: sTime,
            wakeTime: wTime,
            hoursSlept,
            quality: Math.max(1, Math.min(5, qVal)),
            wakeUpCount: Math.max(0, wakeCount),
            observations: sleepObsIndex !== -1 ? String(row[sleepObsIndex] || '').trim() : ''
          },
          seizures: {
            occurred: occurredVal,
            morningCount: mornCount,
            afternoonCount: aftCount,
            nightCount: ngtCount,
            morningDetails: { light: mornCount, medium: 0, strong: 0 }, // fallback values
            afternoonDetails: { light: aftCount, medium: 0, strong: 0 },
            nightDetails: { light: ngtCount, medium: 0, strong: 0 },
            totalCount: occurredVal ? (calculatedSum || 1) : 0, // default to 1 if declared occurred but no count defined
            triggers: seizureTriggersIndex !== -1 ? String(row[seizureTriggersIndex] || '').trim() : '',
            observations: seizureObsIndex !== -1 ? String(row[seizureObsIndex] || '').trim() : ''
          },
          medication: {
            taken: medTaken,
            observations: medicationObsIndex !== -1 ? String(row[medicationObsIndex] || '').trim() : ''
          }
        };

        logsResult.push(singleLog);
      });

      if (logsResult.length === 0) {
        throw new Error('Nenhum registro correspondente pôde ser analisado com os mapeamentos fornecidos.');
      }

      setParsedLogs(logsResult);
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de processamento nos dados. Verifique o formato do arquivo.');
    }
  };

  const handleTriggerUpload = async () => {
    setIsSyncing(true);
    try {
      await onImportComplete(parsedLogs);
    } catch (err: any) {
      setErrorMsg('Erro ao gravar o lote no banco de dados. Verifique a permissão do usuário.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto" id="importer-modal">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col my-8 border border-slate-100"
      >
        {/* Header wrapper */}
        <div className="bg-rose-500 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6" />
            <div>
              <h2 className="text-lg font-bold">Importação de Planilha Histórica</h2>
              <p className="text-xs text-rose-100">Carregue dados de crises salvos desde 2023</p>
            </div>
          </div>
          <button 
            id="close-importer"
            onClick={onClose} 
            className="p-1.5 hover:bg-white/20 rounded-full transition cursor-pointer"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* Steps Status Bar */}
        <div className="grid grid-cols-3 bg-slate-50 border-b border-slate-100 text-center text-xs py-3 font-semibold">
          <div className={`${step === 1 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>1. Enviar Arquivo</div>
          <div className={`${step === 2 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>2. Mapear Colunas</div>
          <div className={`${step === 3 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>3. Revisar & Confirmar</div>
        </div>

        {/* Scrollable Container Body */}
        <div className="p-6 overflow-y-auto max-h-[60vh] flex-1">
          {errorMsg && (
            <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs border border-amber-200 mb-4 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* STEP 1: CHOOSE CSV FILE */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center">
                <Upload className="h-12 w-12 text-slate-400 mb-4" />
                <h3 className="font-bold text-slate-700 text-base">Selecione o arquivo da planilha</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  O arquivo pode estar no formato Excel **(.xlsx, .xls)** ou text/CSV **(.csv)**.
                </p>

                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  id="btn-select-file"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-xs shadow-sm transition cursor-pointer"
                >
                  Procurar Computador / Celular
                </button>
              </div>

              {/* Template Information Card */}
              <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100 flex items-start gap-3.5">
                <HelpCircle className="h-5 w-5 text-sky-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 space-y-1.5 flex-1">
                  <p className="font-bold text-slate-800">Precisa de ajuda com o layout?</p>
                  <p>Mapeie seus próprios cabeçalhos ou faça o download de nosso modelo padrão pronto com todos os campos estruturados para facilitar seu preenchimento.</p>
                  <div>
                    <button
                      type="button"
                      id="btn-download-template"
                      onClick={handleDownloadTemplate}
                      className="inline-flex items-center gap-1.5 text-rose-600 font-bold hover:underline mb-1 cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar modelo padrão (.CSV)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: MAP FIELDS */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs text-slate-500">
                Detectamos <span className="font-bold text-slate-700">{csvHeaders.length} colunas</span> e <span className="font-bold text-slate-700">{csvRows.length} linhas</span> no arquivo <span className="font-mono text-slate-700 font-semibold">"{fileName}"</span>. Associe cada dado de controle ao campo correspondente.
              </div>

              <div className="space-y-3.5">
                {[
                  { field: 'date', label: 'Data do Registro (Obrigatório)', desc: 'Ex: 2023-01-01 ou 01/01/2023' },
                  { field: 'sleepStatus', label: 'Status de Sono (Opcional)', desc: 'Se a criança dormiu, não dormiu, etc.' },
                  { field: 'sleepTime', label: 'Horário que Dormiu (Opcional)', desc: 'HH:MM (ex: 21:30)' },
                  { field: 'wakeTime', label: 'Horário do Despertar (Opcional)', desc: 'HH:MM (ex: 07:00)' },
                  { field: 'sleepQuality', label: 'Aproveitamento/Qualidade de Sono (Opcional)', desc: 'Nota numérica de 1 a 5' },
                  { field: 'wakeUpCount', label: 'Vezes Acordou Noite (Opcional)', desc: 'Número inteiro' },
                  { field: 'sleepObs', label: 'Notas e Obs do Sono (Opcional)', desc: 'Texto livre' },
                  { field: 'seizuresOccurred', label: 'Ocorreu Crise? (Opcional)', desc: 'Geralmente "Sim" ou "Não"' },
                  { field: 'seizureMorning', label: 'Total de Crises de Manhã (Opcional)', desc: 'Quantidade no período' },
                  { field: 'seizureAfternoon', label: 'Total de Crises à Tarde (Opcional)', desc: 'Quantidade no período' },
                  { field: 'seizureNight', label: 'Total de Crises de Noite (Opcional)', desc: 'Quantidade no período' },
                  { field: 'seizureTriggers', label: 'Gatilhos da Crise (Opcional)', desc: 'Fatores desencadeadores' },
                  { field: 'seizureObs', label: 'Notas e Comportamento da Crise (Opcional)', desc: 'Texto livre' },
                  { field: 'medicationTaken', label: 'Tomou Remedicação? (Opcional)', desc: 'Medicação tomada: "Sim" ou "Não"' },
                  { field: 'medicationObs', label: 'Notas das Medicações (Opcional)', desc: 'Texto' }
                ].map((item) => (
                  <div key={item.field} className="grid grid-cols-1 md:grid-cols-2 gap-2 border-b border-slate-50 pb-2 bg-slate-50/20 p-2 rounded-lg">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">{item.label}</span>
                      <span className="text-[10px] text-slate-400">{item.desc}</span>
                    </div>
                    <div>
                      <select
                        id={`select-map-${item.field}`}
                        value={mapping[item.field as keyof ColumnMapping]}
                        onChange={(e) => handleUpdateMapping(item.field as keyof ColumnMapping, e.target.value)}
                        className="w-full text-xs bg-white text-slate-700 border border-slate-200 rounded-lg p-2 font-mono"
                      >
                        <option value="">-- Pular / Não importar --</option>
                        {csvHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & REVIEW */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-slate-600">
                  <p className="font-bold text-slate-800">Pronto para mapear no Banco de Dados!</p>
                  <p className="mt-1">
                    Analisamos sua planilha e localizamos <span className="font-bold text-emerald-800">{parsedLogs.length} linhas de registros válidos</span> prontos para serem estruturados.
                  </p>
                </div>
              </div>

              {/* Quick Table Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-[11px] max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase tracking-wider">
                      <th className="p-2 border-r border-slate-200">Data</th>
                      <th className="p-2 border-r border-slate-200">Sono</th>
                      <th className="p-2 border-r border-slate-200">Dur.(h)</th>
                      <th className="p-2 border-r border-slate-200">Qualid.</th>
                      <th className="p-2 border-r border-slate-200">Crise?</th>
                      <th className="p-2 border-r border-slate-200">Crises</th>
                      <th className="p-2">Med.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedLogs.slice(0, 15).map((log, index) => (
                      <tr key={index} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="p-2 font-bold text-slate-700 border-r border-slate-200">{log.date?.split('-').reverse().join('/')}</td>
                        <td className="p-2 text-slate-600 border-r border-slate-200 capitalize">{log.sleep?.status}</td>
                        <td className="p-2 text-slate-600 border-r border-slate-200">{log.sleep?.hoursSlept}</td>
                        <td className="p-2 text-slate-600 border-r border-slate-200">{log.sleep?.quality} ⭐</td>
                        <td className="p-2 text-slate-600 border-r border-slate-200">{log.seizures?.occurred ? 'Sim' : 'Não'}</td>
                        <td className="p-2 font-bold text-rose-500 border-r border-slate-200 text-center">{log.seizures?.totalCount}</td>
                        <td className="p-2 text-slate-600">{log.medication?.taken ? 'Sim' : 'Não'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedLogs.length > 15 && (
                  <div className="bg-slate-50 text-slate-400 text-center py-2 border-t border-slate-100 italic">
                    ... e mais {parsedLogs.length - 15} registros adicionais.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Panel Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-between">
          <div>
            {step > 1 && (
              <button
                type="button"
                id="btn-back-step"
                onClick={() => setStep((step - 1) as any)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 font-medium text-xs shadow-xs transition select-none cursor-pointer"
              >
                Voltar
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {step === 1 && (
              <button
                type="button"
                id="close-importer-button"
                onClick={onClose}
                className="px-4 py-2 text-slate-500 font-medium text-xs select-none cursor-pointer"
              >
                Cancelar
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                id="btn-verify-mapping"
                onClick={handleProcessMappingAndVerify}
                className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                Analisar & Comparar
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                id="btn-confirm-upload"
                disabled={isSyncing}
                onClick={handleTriggerUpload}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Buscando Sincronização... ({parsedLogs.length})
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 animate-bounce" />
                    Confirmar Gravação de Lote ({parsedLogs.length})
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
