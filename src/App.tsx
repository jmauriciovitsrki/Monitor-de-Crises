import React, { useEffect, useState } from 'react';
import { auth, db, OperationType, handleFirestoreError, isPlaceholderConfig, testConnection } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp, Timestamp, writeBatch 
} from 'firebase/firestore';
import { DailyLog, SleepStatus, SeizureTimingCounts } from './types';
import AuthScreen from './components/AuthScreen';
import DailyForm from './components/DailyForm';
import CSVImporter from './components/CSVImporter';
import ReportDashboard from './components/ReportDashboard';
import RecordHistory from './components/RecordHistory';

import { 
  Heart, Calendar, FileSpreadsheet, BarChart3, LogOut, CheckSquare, RefreshCw, 
  Settings2, Smartphone, ShieldCheck, Info
} from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLocalDemo, setIsLocalDemo] = useState(false);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Modals / workflows triggers
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [showImporter, setShowImporter] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'reports'>('history');

  // Automated prompt status tracker (stores if we checked or prompted today already during this browser tab session)
  const [promptedToday, setPromptedToday] = useState(false);
  const [childName, setChildName] = useState<string>(() => {
    return localStorage.getItem('childName') || 'Minha Criança';
  });
  const [isEditingName, setIsEditingName] = useState(false);

  // Helper local timezone date string selector
  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 0. Test connection on initial application boot
  useEffect(() => {
    testConnection();
  }, []);

  // 1. Hook for tracking user auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setIsLocalDemo(false);
      } else {
        setUser(null);
        // check if user wants to keep using demomode
        const wasInDemo = localStorage.getItem('wasInDemo') === 'true';
        if (wasInDemo) {
          setIsLocalDemo(true);
        }
      }
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  // 2. Load and sync clinical logs records (either Firebase snapshot channel or localStorage cache)
  useEffect(() => {
    setLogs([]);
    if (isLocalDemo) {
      setLogsLoading(true);
      try {
        const stored = localStorage.getItem('offlinelogs');
        if (stored) {
          setLogs(JSON.parse(stored));
        }
      } catch (err) {
        console.error('Error loading offline logs:', err);
      } finally {
        setLogsLoading(false);
      }
    } else if (user) {
      setLogsLoading(true);
      const userLogsPath = `users/${user.uid}/logs`;
      const q = collection(db, 'users', user.uid, 'logs');
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedLogs: DailyLog[] = [];
          
          snapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            
            // Format timestamp instances back into ISO string definitions
            let createdAtStr = new Date().toISOString();
            let updatedAtStr = new Date().toISOString();

            if (data.createdAt instanceof Timestamp) {
              createdAtStr = data.createdAt.toDate().toISOString();
            } else if (typeof data.createdAt === 'string') {
              createdAtStr = data.createdAt;
            }

            if (data.updatedAt instanceof Timestamp) {
              updatedAtStr = data.updatedAt.toDate().toISOString();
            } else if (typeof data.updatedAt === 'string') {
              updatedAtStr = data.updatedAt;
            }

            fetchedLogs.push({
              ...(data as Omit<DailyLog, 'id'>),
              id: docSnapshot.id,
              createdAt: createdAtStr,
              updatedAt: updatedAtStr,
            } as DailyLog);
          });
          
          setLogs(fetchedLogs);
          setLogsLoading(false);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, userLogsPath);
          setLogsLoading(false);
        }
      );

      return unsubscribe;
    }
  }, [user, isLocalDemo]);

  // 3. AUTOMATED DIALOG PROMPTER CHECK
  // Trigger daily checklist pop-up if they haven't filled in today's tracking yet during startup
  useEffect(() => {
    if (!logsLoading && logs.length > 0 && !promptedToday && !showForm) {
      const todayStr = getLocalDateString();
      const hasTodayRecord = logs.some(log => log.date === todayStr);
      
      if (!hasTodayRecord) {
        setPromptedToday(true);
        // Delay slightly for fluid UI reveal once dashboards render
        setTimeout(() => {
          setEditingLog(null);
          setShowForm(true);
        }, 1200);
      }
    }
  }, [logs, logsLoading, promptedToday, showForm]);

  const handleLogNameChange = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('childName', childName);
    setIsEditingName(false);
  };

  const handleSaveLog = async (partialLog: Partial<DailyLog>) => {
    const todayStr = partialLog.date || getLocalDateString();
    
    if (isLocalDemo) {
      // Local Mode: update array
      const existingIdx = logs.findIndex(log => log.date === todayStr);
      let newLogsList = [...logs];

      const fullLog: DailyLog = {
        userId: 'local-demo-user',
        date: todayStr,
        sleep: partialLog.sleep!,
        seizures: partialLog.seizures!,
        medication: partialLog.medication!,
        createdAt: existingIdx !== -1 ? logs[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existingIdx !== -1) {
        newLogsList[existingIdx] = fullLog;
      } else {
        newLogsList.push(fullLog);
      }

      setLogs(newLogsList);
      localStorage.setItem('offlinelogs', JSON.stringify(newLogsList));
      setShowForm(false);
      setEditingLog(null);
    } else if (user) {
      // Firebase Mode
      const logId = todayStr;
      const pathForWrite = `users/${user.uid}/logs/${logId}`;
      
      try {
        const docRef = doc(db, 'users', user.uid, 'logs', logId);
        
        // Find existing record locally if available
        const localExisting = logs.find(log => log.date === logId);
        
        const payload = {
          userId: user.uid,
          date: todayStr,
          sleep: {
            status: partialLog.sleep!.status,
            sleepTime: partialLog.sleep!.sleepTime || '21:00',
            wakeTime: partialLog.sleep!.wakeTime || '07:00',
            hoursSlept: Number(partialLog.sleep!.hoursSlept || 0),
            quality: Number(partialLog.sleep!.quality || 4),
            wakeUpCount: Number(partialLog.sleep!.wakeUpCount || 0),
            observations: String(partialLog.sleep!.observations || '').trim(),
          },
          seizures: {
            occurred: Boolean(partialLog.seizures!.occurred),
            morningCount: Number(partialLog.seizures!.morningCount || 0),
            afternoonCount: Number(partialLog.seizures!.afternoonCount || 0),
            nightCount: Number(partialLog.seizures!.nightCount || 0),
            morningDetails: partialLog.seizures!.morningDetails || { light: 0, medium: 0, strong: 0 },
            afternoonDetails: partialLog.seizures!.afternoonDetails || { light: 0, medium: 0, strong: 0 },
            nightDetails: partialLog.seizures!.nightDetails || { light: 0, medium: 0, strong: 0 },
            totalCount: Number(partialLog.seizures!.totalCount || 0),
            triggers: String(partialLog.seizures!.triggers || '').trim(),
            observations: String(partialLog.seizures!.observations || '').trim(),
          },
          medication: {
            taken: Boolean(partialLog.medication!.taken),
            observations: String(partialLog.medication!.observations || '').trim(),
          },
          createdAt: localExisting ? Timestamp.fromDate(new Date(localExisting.createdAt)) : serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(docRef, payload);
        setShowForm(false);
        setEditingLog(null);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, pathForWrite);
      }
    }
  };

  const handleDeleteLog = async (dateStr: string) => {
    if (isLocalDemo) {
      const filtered = logs.filter(log => log.date !== dateStr);
      setLogs(filtered);
      localStorage.setItem('offlinelogs', JSON.stringify(filtered));
    } else if (user) {
      const pathForDelete = `users/${user.uid}/logs/${dateStr}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'logs', dateStr));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, pathForDelete);
      }
    }
  };

  // Supports uploading all items parsed from the spreadsheet importer wizard
  const handleBatchImport = async (parsedLogs: Partial<DailyLog>[]) => {
    if (isLocalDemo) {
      let merged = [...logs];
      
      parsedLogs.forEach(incomingLog => {
        const existingIdx = merged.findIndex(log => log.date === incomingLog.date);
        
        const fullItem: DailyLog = {
          userId: 'local-demo-user',
          date: incomingLog.date!,
          sleep: incomingLog.sleep!,
          seizures: incomingLog.seizures!,
          medication: incomingLog.medication!,
          createdAt: existingIdx !== -1 ? merged[existingIdx].createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (existingIdx !== -1) {
          merged[existingIdx] = fullItem;
        } else {
          merged.push(fullItem);
        }
      });

      setLogs(merged);
      localStorage.setItem('offlinelogs', JSON.stringify(merged));
      setShowImporter(false);
    } else if (user) {
      // Use Firestore writeBatch for high performance chunked database transactions (max 500 records per batch)
      const chunkSize = 400;
      try {
        for (let i = 0; i < parsedLogs.length; i += chunkSize) {
          const chunk = parsedLogs.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          
          for (const incomingLog of chunk) {
            const logId = incomingLog.date!;
            const docRef = doc(db, 'users', user.uid, 'logs', logId);
            
            const localExisting = logs.find(log => log.date === logId);

            const payload = {
              userId: user.uid,
              date: incomingLog.date!,
              sleep: {
                status: incomingLog.sleep!.status,
                sleepTime: incomingLog.sleep!.sleepTime || '21:00',
                wakeTime: incomingLog.sleep!.wakeTime || '07:00',
                hoursSlept: Number(incomingLog.sleep!.hoursSlept || 0),
                quality: Number(incomingLog.sleep!.quality || 4),
                wakeUpCount: Number(incomingLog.sleep!.wakeUpCount || 0),
                observations: String(incomingLog.sleep!.observations || '').trim(),
              },
              seizures: {
                occurred: Boolean(incomingLog.seizures!.occurred),
                morningCount: Number(incomingLog.seizures!.morningCount || 0),
                afternoonCount: Number(incomingLog.seizures!.afternoonCount || 0),
                nightCount: Number(incomingLog.seizures!.nightCount || 0),
                morningDetails: incomingLog.seizures!.morningDetails || { light: 0, medium: 0, strong: 0 },
                afternoonDetails: incomingLog.seizures!.afternoonDetails || { light: 0, medium: 0, strong: 0 },
                nightDetails: incomingLog.seizures!.nightDetails || { light: 0, medium: 0, strong: 0 },
                totalCount: Number(incomingLog.seizures!.totalCount || 0),
                triggers: String(incomingLog.seizures!.triggers || '').trim(),
                observations: String(incomingLog.seizures!.observations || '').trim(),
              },
              medication: {
                taken: Boolean(incomingLog.medication!.taken),
                observations: String(incomingLog.medication!.observations || '').trim(),
              },
              createdAt: localExisting ? Timestamp.fromDate(new Date(localExisting.createdAt)) : serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            batch.set(docRef, payload);
          }

          await batch.commit();
        }
      } catch (err) {
        const pathForBatchWrite = `users/${user.uid}/logs/batch-sync`;
        handleFirestoreError(err, OperationType.WRITE, pathForBatchWrite);
        throw err;
      }
      setShowImporter(false);
    }
  };

  const handleStartLocalDemo = () => {
    localStorage.setItem('wasInDemo', 'true');
    setIsLocalDemo(true);
  };

  const handleSignOut = async () => {
    localStorage.removeItem('wasInDemo');
    setIsLocalDemo(false);
    await signOut(auth);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500 mb-4" />
        <p className="text-xs font-semibold text-slate-500">Iniciando painel de monitoramento pediátrico...</p>
      </div>
    );
  }

  if (!user && !isLocalDemo) {
    return <AuthScreen onLocalDemo={handleStartLocalDemo} isLoading={authLoading} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-700 flex flex-col" id="app-container">
      
      {/* Dynamic system alerts on top */}
      {isLocalDemo && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2" id="demo-mode-alert">
          <Info className="h-4 w-4" />
          <span>Modo de Demonstração Local Ativo. Dados salvos apenas neste navegador. Vincule o Firebase para obter armazenamento durável na nuvem.</span>
        </div>
      )}

      {/* Main Top Navbar */}
      <header className="bg-white border-b border-slate-100 py-4 px-6 sticky top-0 z-40 shadow-xs" id="nav-header">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo and Child's profile edit controls */}
          <div className="flex items-center gap-3">
            <div className="bg-rose-500 text-white p-2.5 rounded-2xl shadow-sm">
              <Heart className="h-5 w-5 fill-current" />
            </div>
            <div>
              {isEditingName ? (
                <form onSubmit={handleLogNameChange} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    className="border border-slate-200 bg-slate-50 font-bold text-slate-800 text-sm px-2 py-1 rounded-lg outline-none focus:border-rose-400"
                    autoFocus
                  />
                  <button 
                    type="submit" 
                    className="bg-emerald-500 text-white px-2.5 py-1 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Salvar
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5 group">
                  <h1 className="text-base font-extrabold text-slate-800 tracking-tight leading-none">
                    Monitoramento • {childName}
                  </h1>
                  <button 
                    onClick={() => setIsEditingName(true)} 
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    title="Editar nome da criança"
                  >
                    <Settings2 className="h-3 w-3" />
                  </button>
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-0.5 leading-none font-medium">Acompanhamento diário clínico</p>
            </div>
          </div>

          {/* User badge and LogOut controls */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-extrabold text-slate-800 tracking-tight">
                {user ? user.displayName || 'Utilizador' : 'Sessão Offline'}
              </p>
              <p className="text-[9px] text-slate-400 tracking-tight">
                {user ? user.email : 'Armazenamento Local'}
              </p>
            </div>
            
            <button
              id="btn-signout"
              onClick={handleSignOut}
              className="p-2 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-500 rounded-xl transition cursor-pointer select-none"
              title="Desconectar do painel"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-6xl mx-auto w-full p-4 sm:p-6 flex-1 space-y-6">
        
        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Section switcher */}
          <div className="bg-slate-200/60 p-1 rounded-2xl flex border border-slate-200/20 max-w-sm">
            <button
              id="tab-history"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition select-none cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckSquare className="h-4 w-4" />
              Diário Pessoal
            </button>
            <button
              id="tab-reports"
              onClick={() => setActiveTab('reports')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition select-none cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Relatório e Gráficos
            </button>
          </div>

          {/* Operation launchers */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="btn-import-spreadsheet"
              onClick={() => setShowImporter(true)}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl shadow-xs transition select-none cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Importar Planilha
            </button>

            <button
              id="btn-add-today"
              onClick={() => {
                setEditingLog(null);
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs rounded-xl shadow-md transition select-none cursor-pointer"
            >
              <Calendar className="h-4 w-4 text-white" />
              Registrar Dia de Hoje
            </button>
          </div>

        </div>

        {/* Dynamic Tab Render viewports */}
        {logsLoading ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-slate-100 shadow-sm flex flex-col justify-center items-center">
            <RefreshCw className="h-8 w-8 text-rose-500 animate-spin mb-3" />
            <p className="text-xs text-slate-400">Recebendo registros clínicos do servidor...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'history' ? (
              <RecordHistory
                logs={logs}
                onEdit={(log) => {
                  setEditingLog(log);
                  setShowForm(true);
                }}
                onDelete={handleDeleteLog}
              />
            ) : (
              <ReportDashboard logs={logs} childName={childName} />
            )}
          </div>
        )}

      </main>

      {/* Modals & Dialogs overlays */}
      {showForm && (
        <DailyForm
          initialDate={editingLog?.date}
          existingLog={editingLog}
          onSave={handleSaveLog}
          onClose={() => {
            setShowForm(false);
            setEditingLog(null);
          }}
        />
      )}

      {showImporter && (
        <CSVImporter
          onImportComplete={handleBatchImport}
          onClose={() => setShowImporter(false)}
        />
      )}

      {/* Footer Info credit */}
      <footer className="bg-white border-t border-slate-100 py-6 text-center text-xs text-slate-400 space-y-2 mt-auto" id="app-footer">
        <div className="flex justify-center items-center gap-1.5 text-slate-500 font-semibold uppercase text-[10px] tracking-widest leading-none">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Nível de segurança militar ativado
        </div>
        <p className="max-w-md mx-auto text-[11px] leading-relaxed px-4">
          Desenvolvido com todo o cuidado para facilitar a rotina de pais e profissionais médicos. Todas as informações contidas são de uso terapêutico pessoal.
        </p>
      </footer>

    </div>
  );
}
