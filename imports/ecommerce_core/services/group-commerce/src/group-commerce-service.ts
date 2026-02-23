import { randomUUID } from 'crypto';
import { EventBus } from '@fusioncommerce/event-bus';
import { GroupCommerceRepository } from './group-commerce-repository.js';
import { CreateGroupCommerceCampaignRequest, GroupCommerceCampaign, ListCampaignsQuery } from './types.js';

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class GroupCommerceService {
  constructor(
    private readonly repository: GroupCommerceRepository,
    private readonly eventBus: EventBus
  ) {}

  async create(request: CreateGroupCommerceCampaignRequest): Promise<GroupCommerceCampaign> {
    const campaign: GroupCommerceCampaign = {
      ...request,
      id: randomUUID(),
      actualParticipants: 0,
      status: 'active'
    };
    await this.repository.create(campaign);
    await this.eventBus.publish('group-commerce.campaign.created', campaign);
    return campaign;
  }

  async findById(id: string): Promise<GroupCommerceCampaign | null> {
    return this.repository.findById(id);
  }

  async list(query: ListCampaignsQuery = {}): Promise<GroupCommerceCampaign[]> {
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(query.limit ?? DEFAULT_LIST_LIMIT)));
    const offset = Math.max(0, Math.floor(query.offset ?? 0));
    return this.repository.findAll({ limit, offset });
  }

  async join(id: string, userId: string): Promise<GroupCommerceCampaign> {
    const campaign = await this.findById(id);
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    if (campaign.status !== 'active') {
      throw new Error('Campaign is not active');
    }
    if (campaign.actualParticipants >= campaign.maxParticipants) {
      throw new Error('Campaign is full');
    }

    const updatedCampaign = await this.repository.update(id, {
      actualParticipants: campaign.actualParticipants + 1
    });

    await this.eventBus.publish('group-commerce.campaign.joined', { campaign: updatedCampaign, userId });

    if (updatedCampaign.actualParticipants >= updatedCampaign.minParticipants) {
      await this.repository.update(id, { status: 'successful' });
      await this.eventBus.publish('group-commerce.campaign.successful', updatedCampaign);
    }
    return updatedCampaign;
  }
}
