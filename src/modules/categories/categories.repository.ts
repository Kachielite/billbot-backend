import { inject, injectable } from 'tsyringe';
import { eq } from 'drizzle-orm';
import Database from '@/common/lib/database';
import { CategorySchema } from './categories.schema';
import { ICategory } from './categories.interface';

export interface ICategoryRepository {
  findAll(): Promise<ICategory[]>;
  findById(id: string): Promise<ICategory | null>;
  findBySlug(slug: string): Promise<ICategory | null>;
  count(): Promise<number>;
  insertMany(categories: ICategory[]): Promise<void>;
}

@injectable()
class CategoryRepositoryImpl implements ICategoryRepository {
  constructor(@inject(Database) private db: Database) {}

  async findAll(): Promise<ICategory[]> {
    const rows = await this.db.client
      .select()
      .from(CategorySchema)
      .where(eq(CategorySchema.isActive, true))
      .orderBy(CategorySchema.group, CategorySchema.name);
    return rows as unknown as ICategory[];
  }

  async findById(id: string): Promise<ICategory | null> {
    const rows = await this.db.client
      .select()
      .from(CategorySchema)
      .where(eq(CategorySchema.id, id))
      .limit(1);
    return (rows[0] as unknown as ICategory) ?? null;
  }

  async findBySlug(slug: string): Promise<ICategory | null> {
    const rows = await this.db.client
      .select()
      .from(CategorySchema)
      .where(eq(CategorySchema.slug, slug))
      .limit(1);
    return (rows[0] as unknown as ICategory) ?? null;
  }

  async count(): Promise<number> {
    const rows = await this.db.client.select().from(CategorySchema);
    return rows.length;
  }

  async insertMany(categories: ICategory[]): Promise<void> {
    if (categories.length === 0) return;
    await this.db.client.insert(CategorySchema).values(categories);
  }
}

export default CategoryRepositoryImpl;
