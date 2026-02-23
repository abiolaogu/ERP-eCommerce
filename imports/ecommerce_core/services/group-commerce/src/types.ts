export interface GroupCommerceCampaign {
  id: string;
  productId: string;
  minParticipants: number;
  maxParticipants: number;
  actualParticipants: number;
  price: number;
  originalPrice: number;
  startTime: string;
  endTime: string;
  status: 'active' | 'successful' | 'failed' | 'expired';
}

export interface CreateGroupCommerceCampaignRequest {
  productId: string;
  minParticipants: number;
  maxParticipants: number;
  price: number;
  originalPrice: number;
  startTime: string;
  endTime: string;
}

export interface JoinGroupCommerceCampaignRequest {
  userId: string;
}

export interface ListCampaignsQuery {
  limit?: number;
  offset?: number;
}
