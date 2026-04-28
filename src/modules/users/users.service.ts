import { inject, injectable } from 'tsyringe';
import { IUserRepository } from './users.repository';
import { UpdateUserDTO, UserResponseDTO } from './users.dto';
import { InternalServerException, ResourceNotFoundException } from '@/common/exception';
import { getCurrency, getCurrencyById } from '@/common/utils/currency';
import { uploadFile } from '@/common/lib/storage';
import logger from '@/common/lib/logger';

export interface IUserService {
  getMe(userId: string): Promise<UserResponseDTO>;
  updateMe(userId: string, data: UpdateUserDTO): Promise<UserResponseDTO>;
  updateAvatar(userId: string, file: Express.Multer.File): Promise<UserResponseDTO>;
  searchByPhone(phone: string): Promise<UserResponseDTO>;
}

@injectable()
class UserService implements IUserService {
  constructor(@inject('IUserRepository') private userRepository: IUserRepository) {}

  async getMe(userId: string): Promise<UserResponseDTO> {
    logger.info(`Fetching profile for user ${userId}`);
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        logger.warn(`User not found: ${userId}`);
        throw new ResourceNotFoundException('User not found.');
      }
      logger.info(`Profile fetched successfully for user ${userId}`);
      return this.mapToDTO(user);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) throw error;
      logger.error(`Error fetching user ${userId}: ${error}`);
      throw new InternalServerException('Failed to fetch user profile.');
    }
  }

  async updateMe(userId: string, data: UpdateUserDTO): Promise<UserResponseDTO> {
    logger.info(`Updating profile for user ${userId}`);
    try {
      const currency = data.currency_id ? getCurrencyById(data.currency_id)?.code : undefined;
      const updated = await this.userRepository.update(userId, {
        name: data.name,
        email: data.email,
        avatarUrl: data.avatar_url,
        phone: data.phone,
        currency,
      });
      logger.info(`Profile updated successfully for user ${userId}`);
      return this.mapToDTO(updated);
    } catch (error) {
      logger.error(`Error updating user ${userId}: ${error}`);
      throw new InternalServerException('Failed to update user profile.');
    }
  }

  async updateAvatar(userId: string, file: Express.Multer.File): Promise<UserResponseDTO> {
    logger.info(`Uploading avatar for user ${userId}`);
    try {
      const avatarUrl = await uploadFile('billbot/avatars', userId, file.buffer, file.mimetype);
      const updated = await this.userRepository.update(userId, { avatarUrl });
      logger.info(`Avatar updated for user ${userId}`);
      return this.mapToDTO(updated);
    } catch (error) {
      logger.error(`Error updating avatar for user ${userId}: ${error}`);
      throw new InternalServerException('Failed to upload avatar.');
    }
  }

  async searchByPhone(phone: string): Promise<UserResponseDTO> {
    logger.info(`Searching user by phone: ${phone}`);
    try {
      const user = await this.userRepository.findByPhone(phone);
      if (!user) {
        logger.warn(`No user found with phone: ${phone}`);
        throw new ResourceNotFoundException('No user found with that phone number.');
      }
      logger.info(`User found by phone: ${phone}`);
      return this.mapToDTO(user);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) throw error;
      logger.error(`Error searching user by phone: ${error}`);
      throw new InternalServerException('Failed to search user.');
    }
  }

  private mapToDTO(user: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    avatarUrl: string | null;
    currency: string;
    createdAt: Date;
  }): UserResponseDTO {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      avatar_url: user.avatarUrl,
      currency: getCurrency(user.currency),
      created_at: user.createdAt,
    };
  }
}

export default UserService;
