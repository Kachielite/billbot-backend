import { inject, injectable } from 'tsyringe';
import { IActivityRepository, IActivityFilters } from './activities.repository';
import { IActivityEnriched } from './activities.interface';
import { IPagination } from '@/common/types/interface';
import { InternalServerException } from '@/common/exception';
import logger from '@/common/lib/logger';

export interface IActivityService {
  listActivitiesForUser(
    userId: string,
    page: number,
    limit: number,
    filters?: IActivityFilters,
  ): Promise<IPagination<IActivityEnriched>>;
}

@injectable()
class ActivityService implements IActivityService {
  constructor(@inject('IActivityRepository') private activityRepository: IActivityRepository) {}

  async listActivitiesForUser(
    userId: string,
    page: number,
    limit: number,
    filters: IActivityFilters = {},
  ): Promise<IPagination<IActivityEnriched>> {
    logger.info(
      `Listing activities for user ${userId}, page ${page}, limit ${limit}, filters: ${JSON.stringify(filters)}`,
    );
    try {
      const offset = (page - 1) * limit;
      const { activities, total } = await this.activityRepository.findForUser(
        userId,
        limit,
        offset,
        filters,
      );
      logger.info(`Found ${total} activity/activities for user ${userId}`);
      return {
        page,
        limit,
        total_items: total,
        pages: Math.ceil(total / limit),
        items: activities,
      };
    } catch (error) {
      logger.error(`Error listing activities for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to list activities.');
    }
  }
}

export default ActivityService;
