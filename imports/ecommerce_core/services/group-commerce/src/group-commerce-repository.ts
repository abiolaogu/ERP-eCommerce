import { Knex } from '@fusioncommerce/database';
import { GroupCommerceCampaign } from './types.js';

export interface GroupCommerceRepository {
  create(campaign: GroupCommerceCampaign): Promise<GroupCommerceCampaign>;
  findById(id: string): Promise<GroupCommerceCampaign | null>;
  findAll(options?: { limit: number; offset: number }): Promise<GroupCommerceCampaign[]>;
  update(id: string, campaign: Partial<GroupCommerceCampaign>): Promise<GroupCommerceCampaign>;
  init(): Promise<void>;
}

export class InMemoryGroupCommerceRepository implements GroupCommerceRepository {
  private campaigns: Map<string, GroupCommerceCampaign> = new Map();

  async init(): Promise<void> { }

  async create(campaign: GroupCommerceCampaign): Promise<GroupCommerceCampaign> {
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  async findById(id: string): Promise<GroupCommerceCampaign | null> {
    return this.campaigns.get(id) ?? null;
  }

  async findAll(options?: { limit: number; offset: number }): Promise<GroupCommerceCampaign[]> {
    const limit = options?.limit ?? this.campaigns.size;
    const offset = options?.offset ?? 0;

    return Array.from(this.campaigns.values())
      .slice(offset, offset + limit);
  }

  async update(id: string, campaign: Partial<GroupCommerceCampaign>): Promise<GroupCommerceCampaign> {
    const existingCampaign = await this.findById(id);
    if (!existingCampaign) {
      throw new Error('Campaign not found');
    }
    const updatedCampaign = { ...existingCampaign, ...campaign };
    this.campaigns.set(id, updatedCampaign);
    return updatedCampaign;
  }
}

export class PostgresGroupCommerceRepository implements GroupCommerceRepository {
  constructor(private readonly knex: Knex) { }

  async init(): Promise<void> {
    const exists = await this.knex.schema.hasTable('group_commerce_campaigns');
    if (!exists) {
      await this.knex.schema.createTable('group_commerce_campaigns', (table: Knex.CreateTableBuilder) => {
        table.string('id').primary();
        table.string('product_id').notNullable();
        table.integer('min_participants').notNullable();
        table.integer('max_participants').notNullable();
        table.integer('actual_participants').notNullable();
        table.decimal('price', 10, 2).notNullable();
        table.decimal('original_price', 10, 2).notNullable();
        table.timestamp('start_time').notNullable();
        table.timestamp('end_time').notNullable();
        table.string('status').notNullable();
      });
    }

    await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_group_campaign_status_end ON group_commerce_campaigns (status, end_time)');
    await this.knex.raw('CREATE INDEX IF NOT EXISTS idx_group_campaign_product ON group_commerce_campaigns (product_id)');
  }

  async create(campaign: GroupCommerceCampaign): Promise<GroupCommerceCampaign> {
    await this.knex('group_commerce_campaigns').insert({
      id: campaign.id,
      product_id: campaign.productId,
      min_participants: campaign.minParticipants,
      max_participants: campaign.maxParticipants,
      actual_participants: campaign.actualParticipants,
      price: campaign.price,
      original_price: campaign.originalPrice,
      start_time: new Date(campaign.startTime),
      end_time: new Date(campaign.endTime),
      status: campaign.status
    });
    return campaign;
  }

  async findById(id: string): Promise<GroupCommerceCampaign | null> {
    const row = await this.knex('group_commerce_campaigns').where({ id }).first();
    if (!row) return null;
    return this.mapRowToCampaign(row);
  }

  async findAll(options?: { limit: number; offset: number }): Promise<GroupCommerceCampaign[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const rows = await this.knex('group_commerce_campaigns')
      .select('*')
      .orderBy('start_time', 'desc')
      .limit(limit)
      .offset(offset);
    return rows.map((row: any) => this.mapRowToCampaign(row));
  }

  async update(id: string, campaign: Partial<GroupCommerceCampaign>): Promise<GroupCommerceCampaign> {
    const updateData: any = {};
    if (campaign.actualParticipants !== undefined) updateData.actual_participants = campaign.actualParticipants;
    if (campaign.status !== undefined) updateData.status = campaign.status;
    // Add other fields if needed

    const [updatedRow] = await this.knex('group_commerce_campaigns')
      .where({ id })
      .update(updateData)
      .returning('*');

    if (!updatedRow) {
      throw new Error('Campaign not found');
    }
    return this.mapRowToCampaign(updatedRow);
  }

  private mapRowToCampaign(row: any): GroupCommerceCampaign {
    return {
      id: row.id,
      productId: row.product_id,
      minParticipants: row.min_participants,
      maxParticipants: row.max_participants,
      actualParticipants: row.actual_participants,
      price: Number(row.price),
      originalPrice: Number(row.original_price),
      startTime: row.start_time.toISOString(),
      endTime: row.end_time.toISOString(),
      status: row.status
    };
  }
}
