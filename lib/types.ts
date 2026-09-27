export type DeliveryStatus = "new" | "assigned" | "seen" | "on_route" | "completed" | "issue";
export type Priority = "normal" | "high" | "critical";

export interface DeliveryItem {
  id: string;
  brand: string;
  product: string;
  model?: string;
  quantity: number;
  serviceRequired?: boolean;
  installationRequired?: boolean;
  takeBackOldProduct?: boolean;
}

export interface DeliveryChecklist {
  addressVerified: boolean;
  customerCalled: boolean;
  productLoaded: boolean;
  modelChecked: boolean;
  accessoriesChecked: boolean;
  returnChecked: boolean;
}

export interface Delivery {
  id: string;
  orderNo: string;
  customerName: string;
  phone: string;
  secondaryPhone?: string;
  address: string;
  district: string;
  city: string;
  date: string;
  timeWindow: string;
  assignee: string;
  assigneeInitials: string;
  status: DeliveryStatus;
  priority: Priority;
  notes?: string;
  items: DeliveryItem[];
  checklist: DeliveryChecklist;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: string;
  deliveryId?: string;
  orderNo?: string;
  actor: string;
  type: "created" | "status" | "checklist" | "issue" | "system";
  title: string;
  detail?: string;
  createdAt: string;
}


export type DeliveryProofType = "photo" | "signature";

export interface DeliveryProof {
  id: string;
  deliveryId: string;
  proofType: DeliveryProofType;
  storagePath: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdBy?: string;
  createdAt: string;
  signedUrl: string;
}
