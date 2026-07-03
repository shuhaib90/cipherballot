export type DocumentType =
  'national_id' | 'passport' |
  'voter_card' | 'driving_license';

export const DOCUMENT_TYPE_MAP: Record<DocumentType, number> = {
  national_id:      1,
  passport:         2,
  voter_card:       3,
  driving_license:  4
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  national_id:      '🪪 National ID Card',
  passport:         '📘 Passport',
  voter_card:       '🗳️ Voter ID Card',
  driving_license:  '🚗 Driving License'
};

export type RequestStatus =
  'Pending' | 'Approved' | 'Rejected' | 'Expired';

export interface IdentityRequest {
  requestId: number;
  citizen: string;
  submittedAt: number;
  docChunkCount: number;
  status: RequestStatus;
  rejectionReason: string;
  commitmentHash: string;
}

export interface CitizenStatus {
  isVerified: boolean;
  isPending: boolean;
  isRegistered: boolean;
  requestId: number;
  status: RequestStatus;
  rejectionReason: string;
  signature?: string;
}

export interface IdentityFormData {
  documentType: DocumentType;
  fullName: string;
  idNumber: string;
  dateOfBirth: string;
  address: string;
  additionalInfo: string;
}
