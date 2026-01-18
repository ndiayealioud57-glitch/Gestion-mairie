
export enum UserRole {
  MAIRE = 'MAIRE',
  SECRETAIRE = 'SECRETAIRE',
  ADMINISTRATEUR = 'ADMINISTRATEUR'
}

export enum DocStatus {
  RECU = 'RECU',
  EN_COURS = 'EN_COURS',
  VALIDE = 'VALIDE',
  ARCHIVE = 'ARCHIVE'
}

export enum Confidentiality {
  PUBLIC = 'PUBLIC',
  CONFIDENTIEL = 'CONFIDENTIEL',
  STRICTEMENT_PRIVE = 'STRICTEMENT_PRIVE'
}

// Nouvelles catégories demandées
export type DocCategory = 
  | 'Courrier Entrant' 
  | 'Courrier Sortant' 
  | 'Arrêté Municipal' 
  | 'Délibération' 
  | 'Note Interne' 
  | 'Dossier Foncier'
  | 'Autre';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export interface Document {
  id: string;
  title: string;
  description: string;
  category: DocCategory;
  service: string; // Service concerné (Urbanisme, RH, Trésorerie...)
  sender: string;
  receivedAt: Date;
  status: DocStatus;
  confidentiality: Confidentiality;
  summary?: string;
  tags: string[];
  metadata: {
    scannedBy: string;
    lastViewedAt?: Date;
    viewCount: number;
  };
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: 'ENREGISTREMENT' | 'CONSULTATION' | 'MODIFICATION';
  docId: string;
  docTitle: string;
  timestamp: Date;
}
