import { container } from 'tsyringe';
import ActivityRepositoryImpl from './activities.repository';
import ActivityService from './activities.service';

export function registerActivityDependencies(): void {
  container.registerSingleton('IActivityRepository', ActivityRepositoryImpl);
  container.registerSingleton<ActivityService>(ActivityService);
}
