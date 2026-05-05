import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  Settings, FileUp, Check, Plus, Trash2, Printer, X, Download, ChevronDown, ChevronUp,
  Pill, Hash, Factory, Calendar, ShieldAlert, ArrowRightLeft, 
  User, Beaker, ThermometerSnowflake, FileSignature, Box, Tag, Package, Camera, CloudUpload, LogIn, LogOut, AlertCircle
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, getDocs, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';

interface FractionationRecord {
  id: string;
  identificacao: string;
  lote: string;
  fabricante: string;
  dataValidadeFabricante: string;
  data: string;
  destino: string;
  psicotropico: boolean;
  mppMav: boolean;
  materialDescartavel: boolean;
  termossensivel: boolean;
  respFracionamento: string;
  quantidade: string;
  conferente: string;
  dataValidadeAposFracionado: string;
  farmaceutico: string;
  imageUrl: string;
  status: string;
  validadoEm: any;
  validadoPor: string;
  validationImageUrl?: string;
  createdAt: any;
  ownerId: string;
}

const VALIDATION_CHECKLIST = [
  "Área de fracionamento limpa e organizada",
  "Temperatura e umidade dentro dos limites (15-30°C; ≤70% UMIDADE)",
  "Equipamentos de proteção individual disponíveis",
  "Superfícies higienizadas com álcool 70%",
  "Ausência de alimentos, bebidas e medicamentos pessoais na área",
  "Medicamento identificado (nome, concentração, forma farmacêutica)",
  "Verificação do lote e validade do medicamento",
  "Medicamento dentro das condições de armazenamento recomendadas",
  "Embalagem original íntegra e sem indícios de adulteração"
];

function ValidationDashboard({ onClose, adminEmail }: { onClose: () => void, adminEmail: string }) {
  const [records, setRecords] = useState<FractionationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [validatingRecordId, setValidatingRecordId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<boolean[]>(new Array(VALIDATION_CHECKLIST.length).fill(false));
  const [validationImage, setValidationImage] = useState<string | null>(null);

  const exportToCSV = () => {
    if (records.length === 0) return;
    const dataToExport = records.map(r => ({
      'Identificação': r.identificacao,
      'Quantidade': r.quantidade,
      'Lote': r.lote,
      'Fabricante': r.fabricante,
      'Resp. Fracionamento': r.respFracionamento,
      'Conferente': r.conferente,
      'Farmacêutico': r.farmaceutico,
      'Validade Após Fracionado': r.dataValidadeAposFracionado,
      'Status': r.status,
      'Data do Registro': r.createdAt ? new Date(r.createdAt.toMillis()).toLocaleString('pt-BR') : '',
      'Validado Por': r.validadoPor || '',
      'Validado Em': r.validadoEm ? new Date(r.validadoEm.toMillis()).toLocaleString('pt-BR') : ''
    }));
    const csvStr = Papa.unparse(dataToExport, { delimiter: ';' });
    
    const blob = new Blob(["\uFEFF" + csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fracionamentos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    setLoading(true);
    const q = collection(db, 'fracionamentos');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRecords: FractionationRecord[] = [];
      snapshot.forEach(docSnap => {
        fetchedRecords.push({ id: docSnap.id, ...docSnap.data() } as FractionationRecord);
      });
      setRecords(fetchedRecords.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
      setLoading(false);
    }, (err) => {
      console.error(err);
      handleFirestoreError(err, OperationType.LIST, 'fracionamentos');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const startValidation = (id: string) => {
    setValidatingRecordId(id);
    setChecklist(new Array(VALIDATION_CHECKLIST.length).fill(false));
    setValidationImage(null);
  };

  const toggleChecklist = (index: number) => {
    setChecklist(prev => {
      const newArr = [...prev];
      newArr[index] = !newArr[index];
      return newArr;
    });
  };

  const handleValidate = async () => {
    if (!validatingRecordId) return;
    try {
      const updateData: any = {
        status: 'validado',
        validadoEm: serverTimestamp(),
        validadoPor: adminEmail,
        checklistPreenchido: true
      };
      if (validationImage) updateData.validationImageUrl = validationImage;

      await updateDoc(doc(db, 'fracionamentos', validatingRecordId), updateData);
      setRecords(prev => prev.map(r => r.id === validatingRecordId ? { ...r, status: 'validado', validadoPor: adminEmail, validationImageUrl: validationImage || undefined } : r));
      setValidatingRecordId(null);
    } catch (e) {
      console.error(e);
      alert('Erro ao validar.');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateDoc(doc(db, 'fracionamentos', id), {
        status: 'recusado',
        validadoEm: serverTimestamp(),
        validadoPor: adminEmail
      });
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'recusado', validadoPor: adminEmail } : r));
    } catch (e) {
      console.error(e);
      alert('Erro ao recusar.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-slate-200">
        <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <Check size={22} className="text-amber-500" />
            Validação de Fracionamentos
          </h2>
          <div className="flex items-center gap-3">
             <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-sm font-bold rounded-xl shadow-sm transition-all border border-emerald-200">
               <Download size={16} /> <span className="hidden sm:inline">Exportar Excel</span>
             </button>
             <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-full transition-all">
               <X size={20} strokeWidth={2.5} />
             </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {loading ? (
            <div className="flex justify-center p-10"><div className="animate-spin text-slate-400"><Settings size={32} /></div></div>
          ) : records.length === 0 ? (
            <div className="text-center p-10 text-slate-500 font-medium">Nenhum registro encontrado.</div>
          ) : (
            <div className="space-y-4">
              {records.map(record => (
                <div key={record.id} className="space-y-2">
                  <div className={`bg-white p-4 rounded-xl border ${validatingRecordId === record.id ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'} shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center transition-all`}>
                    <div className="flex-1 space-y-1 w-full md:w-auto">
                      <div className="flex items-center gap-2 flex-wrap">
                         <span className="font-bold text-slate-800 break-words">{record.identificacao}</span>
                         <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 whitespace-nowrap">Qtd: {record.quantidade}</span>
                      </div>
                      <div className="text-xs text-slate-500 font-medium flex flex-wrap gap-x-4 gap-y-2">
                        <span>Lote: {record.lote || '-'}</span>
                        <span>Farmacêutico: {record.farmaceutico || '-'}</span>
                      </div>
                    </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
                    {record.status === 'pendente' && (
                       <>
                         <button onClick={() => startValidation(record.id)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm">
                           Validar
                         </button>
                         <button onClick={() => handleReject(record.id)} className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-bold rounded-lg shadow-sm">
                           Recusar
                         </button>
                       </>
                    )}
                    {record.status === 'validado' && (
                       <span className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-xs font-bold uppercase tracking-wide">Validado</span>
                    )}
                    {record.status === 'recusado' && (
                       <span className="px-3 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold uppercase tracking-wide">Recusado</span>
                    )}
                    
                    <button 
                      onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors border border-transparent hover:border-slate-200"
                      title="Ver mais detalhes"
                    >
                      {expandedId === record.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {expandedId === record.id && (
                  <div className="mx-4 p-4 mb-2 bg-slate-50 border-x border-b border-slate-200 rounded-b-xl shadow-inner -mt-4 pt-6 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm font-medium text-slate-600">
                      <div>
                        <span className="block text-xs uppercase text-slate-400 font-bold mb-0.5">Fabricante</span>
                        {record.fabricante || '-'}
                      </div>
                      <div>
                        <span className="block text-xs uppercase text-slate-400 font-bold mb-0.5">Resp. Fracionamento</span>
                        {record.respFracionamento || '-'}
                      </div>
                      <div>
                        <span className="block text-xs uppercase text-slate-400 font-bold mb-0.5">Conferente</span>
                        {record.conferente || '-'}
                      </div>
                      <div>
                        <span className="block text-xs uppercase text-slate-400 font-bold mb-0.5">Validade (Após Frac.)</span>
                        {record.dataValidadeAposFracionado || '-'}
                      </div>
                      <div>
                        <span className="block text-xs uppercase text-slate-400 font-bold mb-0.5">Data de Registro</span>
                        {record.createdAt ? new Date(record.createdAt.toMillis()).toLocaleString('pt-BR') : '-'}
                      </div>
                      {record.status !== 'pendente' && (
                        <div>
                          <span className="block text-xs uppercase text-slate-400 font-bold mb-0.5">Status Atualizado Em</span>
                          <span className={`${record.status === 'validado' ? 'text-green-700' : 'text-red-700'}`}>
                             {record.validadoEm ? new Date(record.validadoEm.toMillis()).toLocaleString('pt-BR') : '-'} por {record.validadoPor}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {record.status === 'validado' && record.validationImageUrl && (
                  <div className="mt-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <h4 className="font-bold text-emerald-900 mb-2 flex items-center gap-2 text-sm">
                      <Camera size={16} /> Foto da Validação
                    </h4>
                    <div className="rounded-lg overflow-hidden border border-emerald-200 shadow-sm bg-slate-100 inline-block">
                        <a href={record.validationImageUrl} target="_blank" rel="noopener noreferrer">
                          <img src={record.validationImageUrl} alt="Foto da Validação" className="h-32 object-contain bg-white hover:opacity-90 transition-opacity" />
                        </a>
                    </div>
                  </div>
                )}
                
                {validatingRecordId === record.id && (
                  <div className="mt-4 p-5 bg-indigo-50 border border-indigo-100 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
                    {record.imageUrl && (
                      <div className="mb-4">
                        <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                           <Camera size={18} /> Comprovante Visual do Fracionamento
                        </h3>
                        <div className="rounded-lg overflow-hidden border border-indigo-200 shadow-sm bg-slate-100">
                           <a href={record.imageUrl} target="_blank" rel="noopener noreferrer">
                             <img src={record.imageUrl} alt="Comprovante Visual" className="w-full max-h-96 object-contain bg-white hover:opacity-90 transition-opacity" />
                           </a>
                        </div>
                        <p className="text-xs text-indigo-600 mt-2 font-medium">Clique na imagem para ampliar</p>
                      </div>
                    )}
                    
                    <div className="mb-4 pt-4 border-t border-indigo-100">
                      <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                        <Camera size={18} /> Comprovante Fotográfico do Fracionamento
                      </h3>
                      {validationImage ? (
                        <div className="relative rounded-lg overflow-hidden border border-indigo-200 shadow-sm bg-slate-100 mb-2">
                          <img src={validationImage} alt="Comprovante Fotográfico" className="w-full max-h-96 object-contain bg-white" />
                          <button 
                            onClick={() => setValidationImage(null)}
                            className="absolute top-2 right-2 bg-white/90 backdrop-blur p-1.5 rounded-full text-red-500 shadow-md hover:bg-white transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-indigo-300 bg-indigo-50/50 rounded-xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-400 transition-colors group">
                          <div className="p-2 bg-white rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform text-slate-400 group-hover:text-indigo-500">
                            <Camera size={24} />
                          </div>
                          <span className="text-sm font-semibold text-indigo-700">Tirar foto ou anexar comprovante</span>
                          <span className="text-xs font-medium text-indigo-500 mt-1 text-center">Recomendado tirar no local após validação</span>
                          <input type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => setValidationImage(e.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }} />
                        </label>
                      )}
                    </div>

                    <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                       <Check size={18} /> Checklist de Validação
                    </h3>
                    <div className="space-y-3">
                      {VALIDATION_CHECKLIST.map((item, idx) => (
                        <label key={idx} className="flex items-start gap-3 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={checklist[idx]} 
                            onChange={() => toggleChecklist(idx)}
                            className="mt-1 w-5 h-5 rounded border-indigo-300 text-indigo-600 shadow-sm focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className={`text-sm font-medium ${checklist[idx] ? 'text-indigo-900' : 'text-slate-700'} group-hover:text-indigo-700 transition-colors`}>{item}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-indigo-200">
                      <button 
                        onClick={() => setValidatingRecordId(null)}
                        className="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 text-sm font-bold rounded-lg shadow-sm hover:bg-indigo-50 transition-all"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleValidate}
                        disabled={!checklist.every(Boolean)}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg shadow-md transition-all"
                      >
                        Confirmar Validação
                      </button>
                    </div>
                  </div>
                )}
              </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MedicineRow {
  Produto: string;
  Identificacao: string;
  Lote: string;
  Validade: string;
  Fabricante: string;
}

interface FractionationForm {
  id: string;
  identificacao: string;
  lote: string;
  fabricante: string;
  dataValidadeFabricante: string;
  data: string;
  destino: 'estoque' | 'cautela' | '';
  psicotropico: boolean;
  mppMav: boolean;
  materialDescartavel: boolean;
  termossensivel: boolean;
  respFracionamento: string;
  quantidade: string;
  conferente: string;
  dataValidadeAposFracionado: string;
  farmaceutico: string;
  imageUrl?: string;
}

const TextInput = ({ label, icon: Icon, type = "text", value, onChange, list, placeholder, className = "" }: any) => (
  <div className="flex flex-col gap-1.5 w-full print:break-inside-avoid">
    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
    <div className="relative">
      {Icon && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Icon size={16} />
        </div>
      )}
      <input 
        type={type}
        list={list}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all text-sm outline-none text-slate-800 placeholder:text-slate-400 font-semibold shadow-sm ${className}`}
      />
    </div>
  </div>
);

const CheckBadge = ({ label, checked, onChange, icon: Icon, colorClass }: any) => (
  <label className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all print:border-gray-300 print:bg-white print:text-gray-800 print:flex-row print:justify-start ${checked ? colorClass : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}>
    <input type="checkbox" className="hidden" checked={checked} onChange={e => onChange(e.target.checked)} />
    <Icon size={20} className={`print:hidden ${checked ? '' : 'opacity-60'}`} />
    <span className="text-xs font-bold tracking-wide text-center leading-tight">{label}</span>
    <div className="hidden print:flex items-center justify-center w-4 h-4 border border-gray-400 ml-auto">
      {checked && <Check size={12} strokeWidth={4} />}
    </div>
  </label>
);

const MANUFACTURERS = [
  "Abbott", "Abbvie Farmacêutica", "Accord", "Aché", "Adium", "Allergan", "Amgen",
  "Antibióticos do Brasil", "Apsen Farmacêutica", "Ariston (Blau)", "Aspen Pharma",
  "Astellas", "Astrazeneca", "Bagó do Brasil", "Bausch & Lomb", "Baxter", "Bayer",
  "Beaufor Ipsen", "Beigene", "Belfar", "Bergamo", "Besins Healthcare", "Biogen",
  "Biolab Sanus", "Biomarin", "Biopas", "Blanver", "Blau Farmacêutica",
  "Boehringer Ingelheim", "Brainfarma", "Bristol Myers Squibb", "Catalent",
  "Cellera Farmacêutica", "Chiesi", "Cimed", "Cosmed", "Cristália", "Daiichi Sankyo",
  "Diffucap-Chemobras", "DLA Pharmaceutical Ltda", "Dr. Reddy's", "Eli Lilly",
  "EMS S/A", "EMS Sigma Pharma", "Eurofarma", "Exeltis", "Farma Vision",
  "Farmace Indústria", "Farmanguinhos", "Farmarin", "Farmoquímica S/A", "Ferring",
  "Fiocruz", "Fresenius", "Fundação Oswaldo Cruz", "Furp", "Galderma", "Geolab",
  "Germed", "Gilead", "Glaxosmithkline", "Glenmark", "Grünenthal do Brasil",
  "Halex Istar", "Hemafarma", "Hipolabor", "Hypermarcas", "Hypofarma", "Infan",
  "Instituto Biochimico", "Janssen-Cilag", "Johnson & Johnson", "Kemmi Pharma",
  "Kenvue", "Laboratório Teuto Brasileiro S/A", "Lafepe", "Legrand", "Leo Pharma",
  "Libbs", "Lundbeck Brasil Ltda", "Marjan", "Masters", "Mawdsleys", "MedQuímica",
  "Merck S/A", "Merck Sharp & Dohme", "Moksha", "Multilab", "Mundipharma", "Mylan",
  "Natulab", "Nikkho", "Novartis Biociências", "Nycomed", "Opella Healthcare",
  "Opem", "Organon", "PF Consumer", "Pfizer", "Pharlab", "Pint Pharma",
  "Prati Donaduzzi", "Procter & Gamble", "Ranbaxy", "Reckitt Benckiser",
  "Recordati Rare Diseases", "Roche", "Sandoz", "Sanofi Medley",
  "Santisa Laboratório", "Servier", "Sun Pharmaceutical", "Takeda",
  "Teva Farmacêutica", "Theramex", "Theraskin", "Torrent do Brasil", "TRB Pharma",
  "Ucb Biopharma", "União Química", "United Medical", "Vertex Farmacêutica",
  "Viatris", "Vitamedic", "Wyeth", "Zambon", "Zodiac", "Zydus"
];

function AuthModal({ onClose }: { onClose: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousLogin = async () => {
    setError('');
    setLoading(true);
    
    try {
      await signInAnonymously(auth);
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/admin-restricted-operation') {
        setError('Erro de permissão da API Key. Vá ao Google Cloud Console -> APIs & Services -> Credentials e verifique se a sua API Key (Firebase) tem restrições de site/referrer que estão bloqueando este domínio, ou se a API "Identity Toolkit API" está permitida.');
      } else {
        setError(err.message || 'Erro ao entrar como anônimo');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-200">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <LogIn size={20} className="text-indigo-600" />
            {isLogin ? 'Login' : 'Criar Conta'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>
        <div className="p-6">
          {error && <div className="p-3 mb-4 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 font-medium">{error}</div>}
          
          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-semibold outline-none"
                placeholder="seu@email.com"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Senha</label>
              <input 
                type="password" 
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all font-semibold outline-none"
                placeholder="••••••••"
              />
            </div>
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md disabled:bg-indigo-400 transition-all"
            >
              {loading ? 'Aguarde...' : (isLogin ? 'Entrar' : 'Registrar')}
            </button>
            
            <div className="text-center mt-2">
              <button 
                type="button" 
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800"
              >
                {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já possui conta? Faça Login'}
              </button>
            </div>
          </form>

          <div className="relative flex items-center justify-center mb-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative bg-white px-4">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">ou continue com</span>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={handleGoogleLogin} 
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              <path d="M1 1h22v22H1z" fill="none"/>
            </svg>
            Entrar com o Google
          </button>

          <div className="relative flex items-center py-4">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold uppercase tracking-wider">ou</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <button 
            type="button"
            onClick={handleAnonymousLogin} 
            disabled={loading}
            className="w-full flex items-center justify-center py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Entrar como Visitante (Anônimo)
          </button>
        </div>
      </div>
    </div>
  );
}

function LandingPage({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-inner">
            <Box size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">Fracionamento Digital</h1>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Controle Hospitalar</p>
          </div>
        </div>
        <button 
          onClick={onLogin}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-sm font-bold shadow-md"
        >
          <LogIn size={18} /> 
          <span className="hidden sm:inline">Acessar o Sistema</span>
        </button>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-4xl mx-auto">
        <div className="w-24 h-24 bg-indigo-100 rounded-3xl flex items-center justify-center mb-8 shadow-sm">
          <Box size={48} className="text-indigo-600" />
        </div>
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight mb-6">
          Gestão Inteligente de <span className="text-indigo-600">Fracionamento</span>
        </h2>
        <p className="text-lg md:text-xl text-slate-600 font-medium max-w-2xl mx-auto mb-12">
          O sistema definitivo para controle hospitalar. Registre, valide e acompanhe o fracionamento de medicamentos com segurança, rastreabilidade e simplicidade.
        </p>
        <button 
          onClick={onLogin}
          className="flex items-center gap-3 px-8 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all text-lg font-bold shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-1"
        >
          <LogIn size={24} /> 
          <span>Fazer Login para Começar</span>
        </button>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 text-left w-full">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center text-teal-600">
              <ShieldAlert size={24} />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Segurança Total</h3>
            <p className="text-slate-500 text-sm font-medium">Controle rigoroso de lotes e validades para garantir a segurança do paciente.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
              <Check size={24} />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Validação Integrada</h3>
            <p className="text-slate-500 text-sm font-medium">Sistema de validação dupla com assinatura de farmacêuticos responsáveis.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
            <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600">
              <Camera size={24} />
            </div>
            <h3 className="font-bold text-slate-900 text-lg">Registro Fotográfico</h3>
            <p className="text-slate-500 text-sm font-medium">Armazenamento de imagens da etiqueta primária para auditoria e conferência.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [csvData, setCsvData] = useState<MedicineRow[]>([]);
  const [employees, setEmployees] = useState<string[]>(["Ana Beatriz", "Eloísa", "Gabriela"]);
  const [newEmployee, setNewEmployee] = useState('');
  const [manufacturers, setManufacturers] = useState<string[]>(MANUFACTURERS);
  const [newManufacturer, setNewManufacturer] = useState('');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showValidationDashboard, setShowValidationDashboard] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [forms, setForms] = useState<FractionationForm[]>([createEmptyForm()]);
  const [dbError, setDbError] = useState('');

  function createEmptyForm(): FractionationForm {
    return {
      id: Math.random().toString(36).substr(2, 9),
      identificacao: '',
      lote: '',
      fabricante: '',
      dataValidadeFabricante: '',
      data: new Date().toISOString().split('T')[0],
      destino: '',
      psicotropico: false,
      mppMav: false,
      materialDescartavel: false,
      termossensivel: false,
      respFracionamento: '',
      quantidade: '',
      conferente: '',
      dataValidadeAposFracionado: '',
      farmaceutico: 'João',
      imageUrl: ''
    };
  }

  useEffect(() => {
    const unsubBase = onSnapshot(doc(db, 'config', 'medicamentos_base'), (docSnap) => {
      if (docSnap.exists()) {
        const docData = docSnap.data();
        const parsedStr = docData.data;
        if (parsedStr) {
          const parsed = JSON.parse(parsedStr);
          if (docData.isOptimized) {
             const converted = parsed.map((arr: string[]) => ({
                Produto: arr[0] || '',
                Identificacao: arr[1] || '',
                Lote: arr[2] || '',
                Validade: arr[3] || '',
                Fabricante: arr[4] || ''
             }));
             setCsvData(converted);
          } else {
             setCsvData(parsed);
          }
        }
      }
    }, (e) => {
      console.error("Error loading base from Firebase", e);
      if (e.message && e.message.includes('offline')) {
        setDbError('Erro de conexão com o Banco de Dados (Offline). Isso geralmente acontece se a sua API Key no "Google Cloud Console" possui restrições que bloqueiam a URL deste site, ou se falta permissão para a API do Cloud Firestore.');
      } else {
        setDbError('Erro ao carregar dados do banco: ' + (e.message || 'Erro desconhecido.'));
      }
    });

    const unsubEmp = onSnapshot(doc(db, 'config', 'funcionarios'), (empSnap) => {
      if (empSnap.exists() && empSnap.data().lista) {
        setEmployees(empSnap.data().lista);
      }
    }, (e) => console.error("Error loading employees", e));

    const unsubMfg = onSnapshot(doc(db, 'config', 'fabricantes'), (mfgSnap) => {
      if (mfgSnap.exists() && mfgSnap.data().lista) {
        setManufacturers(mfgSnap.data().lista);
      }
    }, (e) => console.error("Error loading manufacturers", e));

    return () => {
      unsubBase();
      unsubEmp();
      unsubMfg();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  const logout = () => {
    auth.signOut();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as string[][];
        if (data.length === 0) return;
        
        const parsedData: MedicineRow[] = [];
        let currentMed: { Produto: string, Identificacao: string } | null = null;
        
        // Find where the actual data starts by looking for 'Produto' header
        let headerRowIndex = 0;
        while(headerRowIndex < Math.min(10, data.length) && !data[headerRowIndex].some(c => c && c.toLowerCase().includes('produto'))) {
          headerRowIndex++;
        }
        
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i];
          if (row.length < 3) continue;
          
          // Row 1 is usually the ID, Row 2 is the exact string name (Identificação)
          const col1 = row[1]?.trim();
          const col2 = row[2]?.trim();
          
          if (col1 && col2 && col1 !== '' && col2 !== '') {
             currentMed = { Produto: col1, Identificacao: col2 };
          }
          
          if (currentMed) {
             let lote = '';
             let validade = '';
             let fabricante = '';
             
             // Check indices based on the specific export format
             if (row.length > 8) lote = row[8]?.trim();
             if (row.length > 10) validade = row[10]?.trim();
             if (row.length > 20) fabricante = row[20]?.trim();
             
             if(currentMed.Identificacao) {
                 parsedData.push({
                   Produto: currentMed.Produto,
                   Identificacao: currentMed.Identificacao,
                   Lote: lote || '',
                   Validade: validade || '',
                   Fabricante: fabricante || ''
                 });
             }
          }
        }
        
        setCsvData(parsedData);
        try {
          // Optimize JSON structure to save space (array of arrays instead of objects with keys)
          const optimizedData = parsedData.map(d => [d.Produto, d.Identificacao, d.Lote, d.Validade, d.Fabricante]);
          await setDoc(doc(db, 'config', 'medicamentos_base'), { data: JSON.stringify(optimizedData), isOptimized: true });
          alert(`Foram importados ${parsedData.length} registros (lotes) com sucesso! Eles já ficarão salvos para as próximas visitas.`);
        } catch (e: any) {
          console.error("Erro ao salvar base no Firebase:", e);
          alert("Erro ao salvar no Firebase: " + e.message);
        }
        setShowSettings(false);
      }
    });

    e.target.value = '';
  };

  const handleClearData = async () => {
    if(confirm('Tem certeza que deseja limpar os dados importados?')) {
      setCsvData([]);
      try {
        await deleteDoc(doc(db, 'config', 'medicamentos_base'));
      } catch (e: any) {
        console.error("Erro ao apagar base no Firebase:", e);
        alert("Erro ao apagar base no Firebase: " + e.message);
      }
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.trim()) return;
    const updated = [...employees, newEmployee.trim()];
    setEmployees(updated);
    setNewEmployee('');
    try {
      await setDoc(doc(db, 'config', 'funcionarios'), { lista: updated });
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleRemoveEmployee = async (emp: string) => {
    if(confirm(`Remover ${emp}?`)) {
      const updated = employees.filter(e => e !== emp);
      setEmployees(updated);
      try {
        await setDoc(doc(db, 'config', 'funcionarios'), { lista: updated });
      } catch (e: any) {
        console.error(e);
      }
    }
  };

  const handleAddManufacturer = async () => {
    if (!newManufacturer.trim()) return;
    const updated = [...manufacturers, newManufacturer.trim()].sort();
    setManufacturers(updated);
    setNewManufacturer('');
    try {
      await setDoc(doc(db, 'config', 'fabricantes'), { lista: updated });
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleRemoveManufacturer = async (mfg: string) => {
    if(confirm(`Remover ${mfg}?`)) {
      const updated = manufacturers.filter(m => m !== mfg);
      setManufacturers(updated);
      try {
        await setDoc(doc(db, 'config', 'fabricantes'), { lista: updated });
      } catch (e: any) {
        console.error(e);
      }
    }
  };

  const uniqueMedications = useMemo(() => {
    const unique = new Set(csvData.map(d => d.Identificacao).filter(Boolean));
    return Array.from(unique).sort();
  }, [csvData]);

  const updateForm = (id: string, field: keyof FractionationForm, value: any) => {
    setForms(prev => prev.map(form => {
      if (form.id === id) {
        const updated = { ...form, [field]: value };
        
        if (field === 'identificacao') {
          updated.lote = '';
        }
        
        if (field === 'lote' && updated.identificacao) {
          const match = csvData.find(d => d.Identificacao === updated.identificacao && d.Lote === value);
          if (match) {
            if (match.Fabricante) updated.fabricante = match.Fabricante;
            if (match.Validade) {
              const parts = match.Validade.split('/');
              if (parts.length === 3) {
                updated.dataValidadeFabricante = `${parts[2]}-${parts[1]}-${parts[0]}`;
              } else if (match.Validade.includes('-')) {
                updated.dataValidadeFabricante = match.Validade;
              }
            }
          }
        }
        
        return updated;
      }
      return form;
    }));
  };

  const handleSaveAndClear = async () => {
    if (!user) {
      alert("Por favor, faça o login para poder salvar na base.");
      setShowAuth(true);
      return;
    }
    setIsSaving(true);
    let savedCount = 0;
    try {
      // Save all current forms to Firebase
      for (const form of forms) {
        if (!form.identificacao || !form.quantidade) continue; // Skip empty
        
        await setDoc(doc(db, 'fracionamentos', form.id), {
           identificacao: form.identificacao || '',
           lote: form.lote || '',
           fabricante: form.fabricante || '',
           dataValidadeFabricante: form.dataValidadeFabricante || '',
           data: form.data || '',
           destino: form.destino || '',
           psicotropico: form.psicotropico || false,
           mppMav: form.mppMav || false,
           materialDescartavel: form.materialDescartavel || false,
           termossensivel: form.termossensivel || false,
           respFracionamento: form.respFracionamento || '',
           quantidade: form.quantidade || '',
           conferente: form.conferente || '',
           dataValidadeAposFracionado: form.dataValidadeAposFracionado || '',
           farmaceutico: form.farmaceutico || '',
           imageUrl: form.imageUrl || '',
           ownerId: user.uid,
           createdAt: serverTimestamp(),
           status: 'pendente',
           validadoEm: '',
           validadoPor: ''
        }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'fracionamentos'));
        savedCount++;
      }
      if (savedCount > 0) alert('Registro salvo com sucesso!');
      setForms([createEmptyForm()]);
    } catch (e) {
       console.error("Error saving to Firebase:", e);
       alert("Erro ao salvar registro.");
    } finally {
      setIsSaving(false);
    }
  };

  const addNewFormRow = () => setForms(prev => [...prev, createEmptyForm()]);
  const removeForm = (id: string) => setForms(prev => prev.filter(f => f.id !== id));

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-indigo-600">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="font-bold text-slate-500">Carregando aplicação...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LandingPage onLogin={() => setShowAuth(true)} />
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans print:bg-white print:text-black print:m-0 print-exact pb-24">
      {/* Navbar Print Hidden */}
      <nav className="bg-white border-b border-slate-200 px-4 py-4 md:px-6 flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-30 print:hidden shadow-sm">
        <div className="flex items-center gap-3 w-full md:w-auto justify-center md:justify-start">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-inner">
            <Box size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight text-center md:text-left">Fracionamento Digital</h1>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center md:text-left">Controle Hospitalar</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center w-full gap-2 md:w-auto md:justify-end">
            <button 
              onClick={() => {
                 if (window.self !== window.top) {
                   alert("Para imprimir corretamente, por favor, clique no botão 'Opa!' / Abra em uma nova aba, no canto superior direito da tela de preview (ícone de seta com quadrado). A impressão é bloqueada quando acessada via iFrame.");
                 } else {
                   window.print();
                 }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all text-xs sm:text-sm font-bold shadow-sm"
            >
              <Printer size={16} /> <span className="hidden sm:inline">Imprimir</span>
            </button>
            
            {user.email === 'joaopsfarma@gmail.com' && (
              <>
                <button 
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all text-xs sm:text-sm font-bold shadow-sm"
                >
                  <Settings size={16} /> <span className="hidden sm:inline">Base </span>{csvData.length > 0 && `(${csvData.length})`}
                </button>
                <button 
                  onClick={() => setShowValidationDashboard(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 transition-all text-xs sm:text-sm font-bold shadow-sm"
                >
                  <Check size={16} /> <span className="hidden lg:inline">Validar Registros</span>
                </button>
              </>
            )}
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all text-xs sm:text-sm font-bold shadow-sm border border-slate-200"
              title={user.email || ''}
            >
              <LogOut size={16} /> 
              <span className="hidden sm:inline">Sair</span>
            </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="p-4 sm:p-8 max-w-5xl mx-auto print:mx-0 print:p-0 print:max-w-none space-y-8">
        
        {dbError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <div className="font-medium text-sm leading-relaxed">{dbError}</div>
          </div>
        )}

        {/* Print Header */}
        <div className="hidden print:flex mb-8 items-stretch border border-gray-400 rounded-2xl overflow-hidden shadow-sm">
          <div className="w-1/3 bg-gray-50 flex flex-col items-center justify-center p-6 border-r border-gray-400">
             <div className="font-black text-2xl tracking-tighter text-gray-900">Hospital Brasília</div>
             <div className="text-[10px] font-bold mt-1 text-gray-600 uppercase tracking-widest px-3 py-1 bg-gray-200 rounded-full">Unidade Águas Claras</div>
          </div>
          <div className="w-2/3 p-6 flex flex-col justify-center bg-white">
            <h2 className="text-center font-black text-xl tracking-tight text-gray-800 uppercase">
              Livro de Fracionamento
            </h2>
            <p className="text-center text-sm font-bold text-gray-500 mt-1 uppercase tracking-wider">
              Medicamentos com e sem rompimento
            </p>
          </div>
        </div>

        {forms.map((form, index) => {
          const applicableLots = Array.from(new Set(csvData
            .filter(d => d.Identificacao === form.identificacao && d.Lote)
            .map(d => d.Lote)));

          const filteredMeds = (form.identificacao && form.identificacao.length >= 3)
            ? uniqueMedications.filter(m => m.toLowerCase().includes(form.identificacao.toLowerCase())).slice(0, 100)
            : [];

          return (
            <div key={form.id} className="relative bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 transition-all print:p-6 print:print-card">
              
              {/* Delete Button */}
              {forms.length > 1 && (
                <button 
                  onClick={() => removeForm(form.id)}
                  className="absolute -top-3 -right-3 p-2 text-white bg-red-500 hover:bg-red-600 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all print:hidden z-10"
                  title="Remover formulário"
                >
                  <Trash2 size={16} strokeWidth={2.5} />
                </button>
              )}

              {/* Form Section: Medicamento */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 print:border-gray-400 print:mb-6">
                  <Pill size={20} className="text-indigo-600 print:text-gray-600" />
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Dados do Medicamento</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  <div className="md:col-span-8">
                    <TextInput 
                      label="Identificação do Medicamento" 
                      icon={Tag} 
                      value={form.identificacao}
                      onChange={(e: any) => updateForm(form.id, 'identificacao', e.target.value)}
                      list={`meds-${form.id}`}
                      placeholder="Digite pelo menos 3 letras para buscar..."
                    />
                    <datalist id={`meds-${form.id}`}>
                      {filteredMeds.map((med, idx) => (
                        <option key={idx} value={med} />
                      ))}
                    </datalist>
                  </div>
                  <div className="md:col-span-4">
                    <TextInput 
                      label="Quantidade Fracionada" 
                      icon={Hash} 
                      type="number"
                      value={form.quantidade}
                      onChange={(e: any) => updateForm(form.id, 'quantidade', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
                  <div>
                    <TextInput 
                      label="Lote" 
                      icon={BarcodeIcon} 
                      value={form.lote}
                      onChange={(e: any) => updateForm(form.id, 'lote', e.target.value)}
                      list={`lots-${form.id}`}
                      placeholder="Lote do frasco"
                    />
                    <datalist id={`lots-${form.id}`}>
                      {applicableLots.map((lote, idx) => (
                        <option key={idx} value={lote} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <TextInput 
                      label="Fabricante" 
                      icon={Factory} 
                      value={form.fabricante}
                      onChange={(e: any) => updateForm(form.id, 'fabricante', e.target.value)}
                      list={`fabricantes-${form.id}`}
                      placeholder="Nome do laboratório"
                    />
                    <datalist id={`fabricantes-${form.id}`}>
                      {manufacturers.map((fabricante, idx) => (
                        <option key={idx} value={fabricante} />
                      ))}
                    </datalist>
                  </div>
                  <TextInput 
                    label="Validade Fabricante" 
                    icon={Calendar} 
                    type="date"
                    value={form.dataValidadeFabricante}
                    onChange={(e: any) => updateForm(form.id, 'dataValidadeFabricante', e.target.value)}
                  />
                </div>
              </div>

              {/* Form Section: Classificação */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 print:border-gray-400 pb-3">
                  <ShieldAlert size={20} className="text-amber-500 print:text-gray-600" />
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Classificação</h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-2">
                  <CheckBadge 
                    label="Psicotrópico" 
                    icon={Beaker} 
                    checked={form.psicotropico} 
                    onChange={(val: boolean) => updateForm(form.id, 'psicotropico', val)}
                    colorClass="border-orange-500 bg-orange-50 text-orange-700 shadow-sm"
                  />
                  <CheckBadge 
                    label="MPP/MAV" 
                    icon={ShieldAlert} 
                    checked={form.mppMav} 
                    onChange={(val: boolean) => updateForm(form.id, 'mppMav', val)}
                    colorClass="border-red-500 bg-red-50 text-red-700 shadow-sm"
                  />
                  <CheckBadge 
                    label="Termossensível" 
                    icon={ThermometerSnowflake} 
                    checked={form.termossensivel} 
                    onChange={(val: boolean) => updateForm(form.id, 'termossensivel', val)}
                    colorClass="border-sky-500 bg-sky-50 text-sky-700 shadow-sm"
                  />
                  <CheckBadge 
                    label="Medicamento Comum" 
                    icon={Box} 
                    checked={form.materialDescartavel} 
                    onChange={(val: boolean) => updateForm(form.id, 'materialDescartavel', val)}
                    colorClass="border-teal-500 bg-teal-50 text-teal-700 shadow-sm"
                  />
                </div>
              </div>

              {/* Form Section: Execução */}
              <div className="mb-2 print:mb-0">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3 print:border-gray-400 pb-3">
                  <FileSignature size={20} className="text-emerald-600 print:text-gray-600" />
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Execução e Destino</h3>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left block */}
                  <div className="lg:col-span-8 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <TextInput 
                        label="Data" 
                        icon={Calendar} 
                        type="date"
                        value={form.data}
                        onChange={(e: any) => updateForm(form.id, 'data', e.target.value)}
                      />
                      <TextInput 
                        label="Validade Após Fracionado (Opcional)" 
                        icon={Calendar} 
                        type="date"
                        value={form.dataValidadeAposFracionado}
                        onChange={(e: any) => updateForm(form.id, 'dataValidadeAposFracionado', e.target.value)}
                        className="text-emerald-700 border-emerald-300 bg-emerald-50 focus:border-emerald-500 focus:ring-emerald-200"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <div>
                        <TextInput 
                          label="Resp. Fracionamento" 
                          icon={User} 
                          value={form.respFracionamento}
                          onChange={(e: any) => updateForm(form.id, 'respFracionamento', e.target.value)}
                          list={`resp-${form.id}`}
                        />
                        <datalist id={`resp-${form.id}`}>
                          {employees.map((name, idx) => (
                            <option key={idx} value={name} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <TextInput 
                          label="Conferente" 
                          icon={User} 
                          value={form.conferente}
                          onChange={(e: any) => updateForm(form.id, 'conferente', e.target.value)}
                          list={`conferente-${form.id}`}
                        />
                        <datalist id={`conferente-${form.id}`}>
                          {employees.map((name, idx) => (
                            <option key={idx} value={name} />
                          ))}
                        </datalist>
                      </div>
                      <TextInput 
                        label="Farmacêutico" 
                        icon={User} 
                        value={form.farmaceutico}
                        onChange={(e: any) => updateForm(form.id, 'farmaceutico', e.target.value)}
                      />
                    </div>
                  </div>
                  
                  {/* Right block -> Destino & Label Box */}
                  <div className="lg:col-span-4 flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5 h-[68px]">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Destino</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border-2 cursor-pointer transition-all print:border-gray-400 print:text-black ${form.destino === 'estoque' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'}`}>
                            <input type="radio" value="estoque" checked={form.destino === 'estoque'} onChange={() => updateForm(form.id, 'destino', 'estoque')} className="hidden" />
                            <Package size={16} className="print:hidden"/>
                            <span className="text-sm font-bold tracking-tight">Estoque</span>
                            <div className="hidden print:flex ml-auto w-3 h-3 border border-gray-400">{form.destino === 'estoque' && <Check size={10} />}</div>
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-xl border-2 cursor-pointer transition-all print:border-gray-400 print:text-black ${form.destino === 'cautela' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'}`}>
                            <input type="radio" value="cautela" checked={form.destino === 'cautela'} onChange={() => updateForm(form.id, 'destino', 'cautela')} className="hidden" />
                            <ArrowRightLeft size={16} className="print:hidden"/>
                            <span className="text-sm font-bold tracking-tight">Cautela</span>
                            <div className="hidden print:flex ml-auto w-3 h-3 border border-gray-400">{form.destino === 'cautela' && <Check size={10} />}</div>
                        </label>
                      </div>
                    </div>
                    
                    {/* Visual Proof Area */}
                    {form.imageUrl ? (
                      <div className="relative flex-1 mt-auto min-h-[96px] max-h-[160px] overflow-hidden rounded-xl border border-slate-300 print:border-gray-400 print:max-h-none flex items-center justify-center bg-slate-100">
                        <img src={form.imageUrl} alt="Comprovante" className="w-full h-full object-contain" />
                        <button 
                          onClick={() => updateForm(form.id, 'imageUrl', '')}
                          className="absolute top-2 right-2 bg-white/90 backdrop-blur p-1.5 rounded-full text-red-500 shadow-md hover:bg-white transition-colors print:hidden"
                          title="Remover comprovante"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex-1 mt-auto min-h-[96px] bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-center p-4 cursor-pointer hover:bg-slate-100 hover:border-indigo-300 transition-all group print:border-solid print:border-gray-400 print:bg-white print:hover:bg-white">
                        <div className="p-2 bg-white rounded-full shadow-sm mb-2 group-hover:scale-110 transition-transform text-slate-400 group-hover:text-indigo-500 print:hidden">
                          <Camera size={20} strokeWidth={2.5} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors print:text-gray-700">Comprovante Visual</span>
                        <span className="text-xs font-semibold text-slate-500 mt-1 print:hidden">Câmera ou Arquivo</span>
                        <span className="text-xs font-semibold text-slate-400 mt-1 hidden print:block">Fixar comprovante/foto aqui</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (e) => {
                                updateForm(form.id, 'imageUrl', e.target?.result);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

              </div>
              
              <div className="absolute bottom-4 right-6 hidden print:block text-[8px] uppercase text-gray-500 font-bold opacity-80">
                RDC 67 - 2007 - ANVISA
              </div>
            </div>
          );
        })}

        <div className="mt-8 flex flex-col gap-4 justify-center items-center print:hidden relative pt-6 sm:flex-row">
            {!user && (
              <div className="w-full text-center max-w-sm text-amber-600 text-sm font-medium bg-amber-50 p-3 rounded-lg border border-amber-200 shadow-sm sm:absolute sm:-top-12 sm:w-auto">
                Entre ou crie uma conta para salvar seus registros na nuvem.
              </div>
            )}
            
          <button 
            onClick={addNewFormRow}
            className="flex w-full sm:w-auto justify-center items-center gap-2 px-6 py-4 bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-2xl shadow-sm hover:shadow transition-all font-bold text-base z-10"
            title="Adicionar formulário para outro medicamento"
          >
            <Plus size={20} strokeWidth={3} />
            <span>Outro Medicamento</span>
          </button>
          
          <button 
            onClick={handleSaveAndClear}
            disabled={isSaving}
            className={`flex w-full sm:w-auto justify-center items-center gap-2 px-8 py-4 ${isSaving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 focus:ring-4 focus:ring-indigo-200 transition-all font-bold text-lg z-10`}
          >
            <CloudUpload className={isSaving ? "animate-bounce" : ""} size={24} strokeWidth={2.5} /> 
            {isSaving ? 'Salvando...' : 'Salvar Registro'}
          </button>
        </div>

      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showValidationDashboard && user?.email && <ValidationDashboard onClose={() => setShowValidationDashboard(false)} adminEmail={user.email} />}

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Settings size={20} strokeWidth={2.5}/>
                </div>
                Base de Dados
              </h2>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 text-sm text-indigo-900 flex gap-4 items-start shadow-sm shadow-indigo-100/50">
                 <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600 shrink-0 mt-0.5"><FileUp size={18} strokeWidth={2.5} /></div>
                 <div className="leading-relaxed">
                   <strong className="block mb-1 font-black text-base">Importação CSV</strong>
                   Com a nossa atualização, agora processamos corretamente a estrutura da sua planilha para exibir e preencher os <strong>nomes dos medicamentos</strong> em vez dos IDs numéricos.
                 </div>
              </div>

              <div className="flex justify-center">
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-slate-300 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-inner transition-all group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <div className="p-3 bg-white rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform text-slate-400 group-hover:text-indigo-500">
                      <FileUp className="w-6 h-6" strokeWidth={2.5} />
                    </div>
                    <p className="mb-2 text-sm text-slate-600 font-medium"><span className="font-bold text-indigo-600">Clique para selecionar</span> o seu CSV</p>
                  </div>
                  <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                </label>
              </div>

              {csvData.length > 0 && (
                <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                  <div className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                    <span className="font-black text-indigo-700 bg-indigo-100 px-3 py-1 rounded-lg">{csvData.length}</span> registros ativos
                  </div>
                  <button 
                    onClick={handleClearData}
                    className="text-xs text-red-600 border-2 border-red-100 hover:bg-red-50 hover:border-red-200 px-4 py-2 rounded-xl transition-all font-bold shadow-sm"
                  >
                    Excluir Base
                  </button>
                </div>
              )}

              <div className="pt-6 border-t border-slate-100">
                <h3 className="text-base font-black text-slate-800 mb-4">Profissionais (Resp. / Conferente)</h3>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newEmployee}
                    onChange={(e) => setNewEmployee(e.target.value)}
                    placeholder="Nome do profissional"
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
                  />
                  <button
                    onClick={handleAddEmployee}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-sm"
                  >
                    Adicionar
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {employees.map((emp, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      <span className="text-sm font-semibold text-slate-700">{emp}</span>
                      <button onClick={() => handleRemoveEmployee(emp)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X size={14} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                  {employees.length === 0 && (
                    <span className="text-sm text-slate-500 italic">Nenhum profissional cadastrado.</span>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <h3 className="text-base font-black text-slate-800 mb-4">Fabricantes</h3>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newManufacturer}
                    onChange={(e) => setNewManufacturer(e.target.value)}
                    placeholder="Nome do laboratório"
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
                  />
                  <button
                    onClick={handleAddManufacturer}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-sm"
                  >
                    Adicionar
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                  {manufacturers.map((mfg, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                      <span className="text-sm w-24 truncate font-semibold text-slate-700" title={mfg}>{mfg}</span>
                      <button onClick={() => handleRemoveManufacturer(mfg)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <X size={14} strokeWidth={3} />
                      </button>
                    </div>
                  ))}
                  {manufacturers.length === 0 && (
                    <span className="text-sm text-slate-500 italic">Nenhum fabricante cadastrado.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Custom icon component for barcode since lucide Barcode might not exist in old version
const BarcodeIcon = (props: any) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <path d="M3 5v14"></path>
    <path d="M8 5v14"></path>
    <path d="M12 5v14"></path>
    <path d="M17 5v14"></path>
    <path d="M21 5v14"></path>
  </svg>
);
