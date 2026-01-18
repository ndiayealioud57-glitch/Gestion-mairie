
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  History, 
  Search, 
  Bell, 
  X,
  User as UserIcon,
  ChevronRight,
  Eye,
  Settings,
  Lock,
  Clock,
  AlertCircle,
  Zap,
  Map,
  Users,
  UploadCloud,
  Inbox,
  Send,
  Gavel,
  ScrollText,
  FileSignature,
  LogOut,
  Filter,
  CheckCircle2,
  Briefcase,
  Camera,
  Loader2,
  Shield,
  Trash2,
  UserPlus,
  Stamp,
  FileSearch,
  Activity,
  Fingerprint,
  SlidersHorizontal,
  Calendar,
  UserCheck,
  RotateCcw
} from 'lucide-react';
import { User, UserRole, Document, DocStatus, Confidentiality, ActivityLog, DocCategory } from './types';
import { analyzeDocument } from './services/gemini';

const SYSTEM_USERS: User[] = [
  { id: '1', name: 'M. le Maire Serigne Diop', role: UserRole.MAIRE, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' },
  { id: '2', name: 'Fatou Ndiaye (Admin)', role: UserRole.ADMINISTRATEUR, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop' },
  { id: '3', name: 'Amadou Fall (Secrétariat)', role: UserRole.SECRETAIRE, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop' }
];

const CATEGORIES: DocCategory[] = [
  'Courrier Entrant', 
  'Courrier Sortant', 
  'Arrêté Municipal', 
  'Délibération', 
  'Note Interne', 
  'Dossier Foncier',
  'Autre'
];

const CATEGORY_ICONS: Record<DocCategory, React.ReactNode> = {
  'Courrier Entrant': <Inbox />,
  'Courrier Sortant': <Send />,
  'Arrêté Municipal': <Gavel />,
  'Délibération': <FileSignature />,
  'Note Interne': <ScrollText />,
  'Dossier Foncier': <Map />,
  'Autre': <FileText />
};

const INITIAL_DOCS: Document[] = [
  {
    id: 'DOC-2024-001',
    title: 'Délibération n°12 - Extension Zone Industrielle',
    description: 'Vote pour l extension de la zone franche de Sandiara.',
    category: 'Délibération',
    service: 'Conseil Municipal',
    sender: 'Secrétariat Général',
    receivedAt: new Date(Date.now() - 86400000),
    status: DocStatus.VALIDE,
    confidentiality: Confidentiality.PUBLIC,
    tags: ['Industrie', 'Emploi'],
    summary: 'Document stratégique actant l extension de 50 hectares.',
    metadata: { scannedBy: 'Amadou Fall', viewCount: 45 }
  }
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(SYSTEM_USERS[0]);
  const [documents, setDocuments] = useState<Document[]>(INITIAL_DOCS);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'docs' | 'confidential' | 'logs' | 'users'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  
  // États pour la recherche avancée
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterConfidentiality, setFilterConfidentiality] = useState<string>('All');
  const [filterSender, setFilterSender] = useState('');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // LOG AUTOMATIQUE DES CONSULTATIONS
  const logAction = (action: ActivityLog['action'], docId: string, docTitle: string) => {
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      docId,
      docTitle,
      timestamp: new Date()
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const filteredDocs = useMemo(() => {
    return documents.filter(d => {
      // 1. Filtrage par Rôle (Sécurité de base)
      const matchesRole = (() => {
        if (currentUser.role === UserRole.MAIRE) return true;
        if (currentUser.role === UserRole.ADMINISTRATEUR) return d.confidentiality !== Confidentiality.STRICTEMENT_PRIVE;
        return d.confidentiality === Confidentiality.PUBLIC;
      })();
      if (!matchesRole) return false;

      // 2. Recherche Textuelle Globale
      const matchesSearch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           d.description.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // 3. Filtre Catégorie
      if (filterCategory !== 'All' && d.category !== filterCategory) return false;

      // 4. Filtre Confidentialité (manuel)
      if (filterConfidentiality !== 'All' && d.confidentiality !== filterConfidentiality) return false;

      // 5. Filtre Expéditeur
      if (filterSender && !d.sender.toLowerCase().includes(filterSender.toLowerCase()) && !d.service.toLowerCase().includes(filterSender.toLowerCase())) return false;

      // 6. Filtre Dates
      if (filterDateStart) {
        const start = new Date(filterDateStart);
        if (d.receivedAt < start) return false;
      }
      if (filterDateEnd) {
        const end = new Date(filterDateEnd);
        end.setHours(23, 59, 59, 999);
        if (d.receivedAt > end) return false;
      }

      return true;
    });
  }, [documents, currentUser, searchQuery, filterCategory, filterConfidentiality, filterSender, filterDateStart, filterDateEnd]);

  const resetFilters = () => {
    setFilterCategory('All');
    setFilterConfidentiality('All');
    setFilterSender('');
    setFilterDateStart('');
    setFilterDateEnd('');
    setSearchQuery('');
  };

  const handleConsultDoc = (doc: Document) => {
    setSelectedDoc(doc);
    logAction('CONSULTATION', doc.id, doc.title);
    setDocuments(prev => prev.map(d => d.id === doc.id ? {...d, metadata: {...d.metadata, viewCount: d.metadata.viewCount + 1}} : d));
    (document.getElementById('details_modal') as any).showModal();
  };

  const handleAddDocument = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    
    try {
      setUploadStep('IDENTIFICATION AUTOMATIQUE...');
      const formData = new FormData(e.currentTarget);
      const textDesc = formData.get('description') as string;
      const confidentiality = formData.get('confidentiality') as Confidentiality;

      // ANALYSE IA POUR ENREGISTREMENT AUTOMATIQUE
      const analysis = await analyzeDocument(textDesc, previewImage || undefined);
      
      setUploadStep('GÉNÉRATION DES MÉTADONNÉES...');
      await new Promise(r => setTimeout(r, 800));

      const newDoc: Document = {
        id: `SAND-${Date.now().toString().slice(-6)}`,
        title: analysis?.title || (formData.get('title') as string) || "Document Sans Titre",
        description: textDesc || "Document numérisé via terminal mobile.",
        category: (analysis?.category as DocCategory) || 'Autre',
        service: analysis?.service || 'Direction Générale',
        sender: currentUser.name,
        receivedAt: new Date(),
        status: DocStatus.RECU,
        confidentiality,
        summary: analysis?.summary,
        tags: analysis?.tags || [],
        metadata: { scannedBy: currentUser.name, viewCount: 0 }
      };

      setDocuments([newDoc, ...documents]);
      logAction('ENREGISTREMENT', newDoc.id, newDoc.title);

      setIsUploading(false);
      setPreviewImage(null);
      (document.getElementById('upload_modal') as any).close();
      setActiveTab('docs');
    } catch (err) {
      console.error(err);
      setIsUploading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar Sandiara */}
      <aside className="w-80 bg-slate-900 flex flex-col z-50 shadow-2xl">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-10 group cursor-pointer">
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg bg-white p-1 border-2 border-emerald-500">
               <img src="https://api.a0.dev/assets/image?text=Official%20Logo%20Sandiara%20Senegal%20Green%20Star%20Golden%20Wreath&aspect=1:1" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tighter">SANDIARA</h1>
              <p className="text-[9px] font-black text-emerald-400 tracking-[0.2em] uppercase">Secrétariat Digital</p>
            </div>
          </div>

          <nav className="space-y-1">
            <SidebarNavItem icon={<LayoutDashboard />} label="Tableau de Bord" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <SidebarNavItem icon={<FileSearch />} label="GED Municipale" active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} />
            
            {currentUser.role === UserRole.MAIRE && (
              <SidebarNavItem icon={<Lock />} label="Cabinet du Maire" active={activeTab === 'confidential'} onClick={() => setActiveTab('confidential')} color="text-red-400" />
            )}

            {currentUser.role === UserRole.ADMINISTRATEUR && (
              <>
                <SidebarNavItem icon={<Activity />} label="Audit & Traçabilité" active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} />
                <SidebarNavItem icon={<Users />} label="Gestion Agents" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
              </>
            )}
          </nav>
        </div>

        <div className="mt-auto p-6">
          <div className="bg-slate-800/40 p-4 rounded-3xl border border-slate-700/50">
             <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-black text-white truncate">{currentUser.name}</p>
                  <p className="text-[8px] text-emerald-400 font-bold uppercase">{currentUser.role}</p>
                </div>
             </div>
             <div className="grid grid-cols-3 gap-1">
               {SYSTEM_USERS.map(u => (
                 <button 
                  key={u.id} 
                  onClick={() => {setCurrentUser(u); setActiveTab('dashboard'); resetFilters();}}
                  className={`py-1 text-[7px] font-black rounded ${currentUser.id === u.id ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'}`}
                 >
                   {u.role.slice(0, 3)}
                 </button>
               ))}
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 shrink-0">
          <div className="relative w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Rechercher par titre ou contenu..." 
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-4">
             {currentUser.role === UserRole.SECRETAIRE && (
                <button 
                  onClick={() => (document.getElementById('upload_modal') as any).showModal()} 
                  className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-105 transition-transform"
                >
                  <Zap className="w-4 h-4" /> NUMÉRISATION EXPRESS
                </button>
             )}
             <div className="h-10 w-px bg-slate-200 mx-2" />
             <button className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:text-emerald-600 transition-colors relative">
               <Bell className="w-5 h-5" />
               <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 space-y-10">
          {activeTab === 'dashboard' ? (
            <div className="animate-in fade-in duration-500">
               <div className="flex justify-between items-start mb-10">
                 <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Mairie de Sandiara Digital</h2>
                    <p className="text-slate-500 font-medium">Session : {currentUser.name} • {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                 </div>
                 <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Flux Temps Réel Connecté</span>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatCard icon={<Inbox />} label="Archives Totales" value={documents.length} color="emerald" />
                  <StatCard icon={<Stamp />} label="À Signer (Maire)" value={documents.filter(d => d.status === DocStatus.RECU).length} color="blue" />
                  <StatCard icon={<Activity />} label="Flux du Jour" value={logs.filter(l => l.timestamp > new Date(new Date().setHours(0,0,0,0))).length} color="purple" />
                  <StatCard icon={<Shield />} label="Niveau Confiance" value={100} unit="%" color="slate" />
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-10">
                  <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                    <h3 className="text-xl font-black mb-6 flex items-center gap-3"><History className="text-emerald-500" /> Traçabilité des actions récentes</h3>
                    <div className="space-y-4">
                       {logs.slice(0, 6).map(log => (
                         <div key={log.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                             log.action === 'ENREGISTREMENT' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                           }`}>
                             {log.userName.charAt(0)}
                           </div>
                           <div className="flex-1">
                             <p className="text-xs font-bold text-slate-800">
                               <span className="text-emerald-600 mr-2">[{log.userRole}]</span>
                               {log.userName} <span className="text-slate-400 font-medium">{log.action === 'ENREGISTREMENT' ? 'a enregistré' : 'a consulté'}</span> {log.docTitle}
                             </p>
                             <p className="text-[9px] text-slate-400 uppercase font-black mt-0.5">{new Date(log.timestamp).toLocaleTimeString()}</p>
                           </div>
                           <Fingerprint className="w-4 h-4 text-slate-300" />
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                      <h3 className="text-xl font-black mb-6">Répartition Catégories</h3>
                      <div className="space-y-5">
                        {['Courrier Entrant', 'Dossier Foncier', 'Arrêté Municipal'].map(cat => (
                          <div key={cat} className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-60">
                              <span>{cat}</span>
                              <span>{documents.filter(d => d.category === cat).length} docs</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{width: `${(documents.filter(d => d.category === cat).length / (documents.length || 1)) * 100}%`}}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button className="w-full mt-10 py-4 bg-emerald-600 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-emerald-500/20">Analyse détaillée</button>
                    </div>
                    <Zap className="absolute -bottom-10 -right-10 w-40 h-40 text-white/5 rotate-12" />
                  </div>
               </div>
            </div>
          ) : activeTab === 'docs' ? (
            <div className="animate-in slide-in-from-right-10 duration-500">
               <div className="flex justify-between items-end mb-8">
                 <h2 className="text-3xl font-black tracking-tighter">📂 GED Municipale - {currentUser.role}</h2>
                 <div className="flex items-center gap-3">
                   <button 
                     onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
                     className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${isFilterPanelOpen ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                   >
                     <SlidersHorizontal className="w-4 h-4" />
                     {isFilterPanelOpen ? 'Masquer Filtres' : 'Filtres Avancés'}
                   </button>
                   {(filterCategory !== 'All' || filterConfidentiality !== 'All' || filterSender || filterDateStart || filterDateEnd) && (
                     <button onClick={resetFilters} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                       <RotateCcw className="w-5 h-5" />
                     </button>
                   )}
                 </div>
               </div>

               {/* PANNEAU DE RECHERCHE AVANCÉE */}
               {isFilterPanelOpen && (
                 <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm mb-8 animate-in slide-in-from-top-4 duration-300">
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                     <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2"><Calendar className="w-3 h-3" /> Période (Début)</label>
                       <input 
                         type="date" 
                         value={filterDateStart}
                         onChange={(e) => setFilterDateStart(e.target.value)}
                         className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700" 
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2"><Calendar className="w-3 h-3" /> Période (Fin)</label>
                       <input 
                         type="date" 
                         value={filterDateEnd}
                         onChange={(e) => setFilterDateEnd(e.target.value)}
                         className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700" 
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2"><Filter className="w-3 h-3" /> Catégorie</label>
                       <select 
                         value={filterCategory}
                         onChange={(e) => setFilterCategory(e.target.value)}
                         className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 appearance-none"
                       >
                         <option value="All">Toutes Catégories</option>
                         {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                       </select>
                     </div>
                     <div className="space-y-2">
                       <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1 flex items-center gap-2"><UserCheck className="w-3 h-3" /> Expéditeur / Service</label>
                       <input 
                         type="text" 
                         placeholder="Ex: Urbanisme, Amadou..."
                         value={filterSender}
                         onChange={(e) => setFilterSender(e.target.value)}
                         className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700" 
                       />
                     </div>
                   </div>
                   
                   <div className="flex items-center gap-6 mt-6 pt-6 border-t border-slate-100">
                     <div className="flex items-center gap-3">
                       <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Confidentialité :</span>
                       <div className="flex gap-2">
                         {['All', Confidentiality.PUBLIC, Confidentiality.CONFIDENTIEL, Confidentiality.STRICTEMENT_PRIVE].map(level => {
                           // Brider les choix selon le rôle
                           if (level === Confidentiality.STRICTEMENT_PRIVE && currentUser.role !== UserRole.MAIRE) return null;
                           if (level === Confidentiality.CONFIDENTIEL && currentUser.role === UserRole.SECRETAIRE) return null;
                           
                           return (
                             <button 
                               key={level}
                               onClick={() => setFilterConfidentiality(level)}
                               className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${filterConfidentiality === level ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}
                             >
                               {level === 'All' ? 'Tous' : level}
                             </button>
                           );
                         })}
                       </div>
                     </div>
                     <p className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-xl">
                       {filteredDocs.length} document(s) trouvé(s)
                     </p>
                   </div>
                 </div>
               )}

               <div className="grid grid-cols-1 gap-3">
                 {filteredDocs.length > 0 ? filteredDocs.map(doc => (
                   <div key={doc.id} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-500 transition-all flex items-center justify-between group cursor-pointer" onClick={() => handleConsultDoc(doc)}>
                     <div className="flex items-center gap-6">
                        <div className="w-12 h-12 bg-slate-50 text-slate-500 rounded-xl flex items-center justify-center group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                          {CATEGORY_ICONS[doc.category] || <FileText />}
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <h4 className="font-bold text-slate-800">{doc.title}</h4>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-slate-100 text-slate-400 rounded-md">{doc.id}</span>
                          </div>
                          <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
                             <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {new Date(doc.receivedAt).toLocaleDateString()}</span>
                             <span className="flex items-center gap-1.5"><Briefcase className="w-3 h-3" /> {doc.service}</span>
                             <span className="flex items-center gap-1.5 text-emerald-500"><Users className="w-3 h-3" /> {doc.metadata.viewCount} vues</span>
                          </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${
                          doc.status === DocStatus.VALIDE ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                        }`}>{doc.status}</span>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                     </div>
                   </div>
                 )) : (
                   <div className="py-20 text-center space-y-4">
                     <Search className="w-12 h-12 text-slate-200 mx-auto" />
                     <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Aucun document ne correspond à vos filtres.</p>
                     <button onClick={resetFilters} className="text-emerald-600 font-black text-[10px] uppercase border-b-2 border-emerald-600 pb-1">Réinitialiser les filtres</button>
                   </div>
                 )}
               </div>
            </div>
          ) : activeTab === 'logs' ? (
             <div className="animate-in fade-in duration-500">
                <h2 className="text-3xl font-black mb-8 flex items-center gap-4">
                  <Activity className="text-emerald-600" /> Registre Indélébile de Traçabilité
                </h2>
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase text-[9px] tracking-widest">
                        <tr>
                           <th className="px-8 py-5">Date / Heure</th>
                           <th className="px-8 py-5">Identité Agent</th>
                           <th className="px-8 py-5">Nature de l'Action</th>
                           <th className="px-8 py-5">Document Visé</th>
                           <th className="px-8 py-5">ID Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {logs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/50">
                             <td className="px-8 py-5 text-xs font-bold text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                             <td className="px-8 py-5">
                               <div className="flex items-center gap-2">
                                 <span className="w-6 h-6 rounded bg-slate-800 text-white flex items-center justify-center text-[10px] font-black">{log.userName.charAt(0)}</span>
                                 <span className="text-sm font-bold">{log.userName}</span>
                               </div>
                             </td>
                             <td className="px-8 py-5">
                               <span className={`px-2.5 py-1 rounded-md font-black text-[9px] uppercase ${
                                 log.action === 'ENREGISTREMENT' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                               }`}>{log.action}</span>
                             </td>
                             <td className="px-8 py-5 text-xs font-medium italic">"{log.docTitle}"</td>
                             <td className="px-8 py-5 text-[9px] font-black text-slate-300 font-mono">{log.id}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
             </div>
          ) : null}
        </div>
      </main>

      {/* MODAL ENREGISTREMENT AUTO (SECRÉTAIRE) */}
      <dialog id="upload_modal" className="modal p-0 rounded-[2.5rem] backdrop:bg-slate-900/95 backdrop:backdrop-blur-xl border-none shadow-2xl w-full max-w-4xl overflow-hidden">
        <div className="bg-white">
          {isUploading && (
            <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-20 text-center animate-in fade-in">
               <Loader2 className="w-20 h-20 text-emerald-500 animate-spin mb-6" />
               <h3 className="text-2xl font-black text-slate-900 mb-2">{uploadStep}</h3>
               <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em]">IA Sandiara • Enregistrement Automatique</p>
            </div>
          )}

          <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-2xl font-black flex items-center gap-3"><Zap className="text-emerald-600" /> Numérisation Sandiara Express</h3>
            <button onClick={() => (document.getElementById('upload_modal') as any).close()} className="p-2 hover:bg-slate-100 rounded-xl"><X className="w-6 h-6 text-slate-400" /></button>
          </div>

          <form onSubmit={handleAddDocument} className="p-10 grid grid-cols-2 gap-10">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`h-72 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-4 cursor-pointer overflow-hidden transition-all ${previewImage ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300'}`}
            >
              {previewImage ? (
                <img src={previewImage} className="w-full h-full object-cover" alt="Scan" />
              ) : (
                <>
                  <Camera className="w-10 h-10 text-slate-300" />
                  <p className="text-[10px] font-black text-slate-400 uppercase">Scanner Document Administratif</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => setPreviewImage(reader.result as string);
                  reader.readAsDataURL(file);
                }
              }} />
            </div>

            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Description Optionnelle</label>
                <textarea name="description" rows={3} placeholder="L'IA remplira automatiquement les métadonnées après scan..." className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-medium text-slate-700 resize-none text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-1">Classification Initiale</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border-2 border-transparent has-[:checked]:border-emerald-500 cursor-pointer">
                    <input type="radio" name="confidentiality" value={Confidentiality.PUBLIC} defaultChecked className="hidden" />
                    <span className="text-[10px] font-black uppercase">Archives Publiques</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border-2 border-transparent has-[:checked]:border-red-500 cursor-pointer">
                    <input type="radio" name="confidentiality" value={Confidentiality.CONFIDENTIEL} className="hidden" />
                    <span className="text-[10px] font-black uppercase text-red-500">Confidentiel Maire</span>
                  </label>
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-emerald-600 transition-all text-sm flex items-center justify-center gap-3">
                <Zap className="w-5 h-5 text-emerald-400" /> DÉMARRER ENREGISTREMENT AUTO
              </button>
            </div>
          </form>
        </div>
      </dialog>

      {/* MODAL CONSULTATION (TRAÇABILITÉ ACTIVÉE) */}
      <dialog id="details_modal" className="modal p-0 rounded-[2.5rem] backdrop:bg-slate-900/90 backdrop:backdrop-blur-2xl border-none shadow-2xl w-full max-w-4xl overflow-hidden">
        {selectedDoc && (
          <div className="bg-white flex h-full max-h-[80vh]">
            <div className="flex-1 p-12 overflow-y-auto">
               <div className="flex items-center gap-3 mb-6">
                 <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-black text-[9px] uppercase">{selectedDoc.category}</span>
                 <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg font-black text-[9px] uppercase">{selectedDoc.service}</span>
               </div>
               <h3 className="text-4xl font-black text-slate-900 tracking-tighter mb-8 leading-tight">{selectedDoc.title}</h3>
               
               <div className="space-y-8 bg-slate-50 p-8 rounded-3xl border border-slate-100">
                  <h4 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-4 flex items-center gap-2"><Fingerprint className="w-4 h-4" /> Analyse Metadata IA</h4>
                  <p className="text-lg text-slate-700 leading-relaxed font-medium">"{selectedDoc.summary || selectedDoc.description}"</p>
                  
                  <div className="grid grid-cols-2 gap-6 mt-10 pt-8 border-t border-slate-200">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Date Enregistrement</p>
                      <p className="text-sm font-bold text-slate-800">{new Date(selectedDoc.receivedAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Signature Secrétariat</p>
                      <p className="text-sm font-bold text-slate-800">{selectedDoc.metadata.scannedBy}</p>
                    </div>
                  </div>
               </div>
            </div>
            <div className="w-80 bg-slate-100 p-10 flex flex-col justify-between border-l border-slate-200">
               <div className="space-y-6">
                  <div className="p-5 bg-white rounded-2xl border border-slate-200 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Audit de Sécurité</p>
                    <div className="flex justify-center gap-2 mb-2">
                       <Shield className="w-5 h-5 text-emerald-500" />
                       <Lock className="w-5 h-5 text-emerald-500" />
                    </div>
                    <p className="text-[9px] font-bold text-slate-500">Document Chiffré AES-256</p>
                  </div>

                  <div className="space-y-3">
                    <button className="w-full py-4 bg-white border border-slate-200 text-slate-800 font-black text-[10px] uppercase rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50">
                      <FileSearch className="w-4 h-4" /> Visualiser l'Original
                    </button>
                    {currentUser.role === UserRole.MAIRE && selectedDoc.status !== DocStatus.VALIDE && (
                      <button className="w-full py-4 bg-emerald-600 text-white font-black text-[10px] uppercase rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                        <Stamp className="w-4 h-4" /> Signer Numériquement
                      </button>
                    )}
                  </div>
               </div>
               <button onClick={() => (document.getElementById('details_modal') as any).close()} className="w-full py-3 text-slate-400 font-black uppercase text-[9px]">Fermer le dossier</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode, label: string, value: number, color: string, unit?: string }> = ({ icon, label, value, color, unit }) => {
  const themes = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-100 text-slate-600'
  };
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${themes[color as keyof typeof themes]}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
      </div>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-900">{value}{unit}</p>
    </div>
  );
};

const SidebarNavItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void, color?: string }> = ({ icon, label, active, onClick, color }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl transition-all font-bold group ${active ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}>
    <span className={active ? 'text-white' : (color || 'text-slate-600 group-hover:text-emerald-400')}>{icon}</span>
    <span className="text-[11px] uppercase tracking-tight">{label}</span>
    {active && <ChevronRight className="ml-auto w-3 h-3 text-white/50" />}
  </button>
);

export default App;
