import { inject, injectable } from 'tsyringe';
import { IUserRepository } from './users.repository';
import { UpdateUserDTO, UserResponseDTO } from './users.dto';
import { InternalServerException, ResourceNotFoundException } from '@/common/exception';
import logger from '@/common/lib/logger';

export interface IUserService {
  getMe(userId: string): Promise<UserResponseDTO>;
  updateMe(userId: string, data: UpdateUserDTO): Promise<UserResponseDTO>;
  searchByPhone(phone: string): Promise<UserResponseDTO>;
}

@injectable()
class UserService implements IUserService {
  constructor(@inject('IUserRepository') private userRepository: IUserRepository) {}

  async getMe(userId: string): Promise<UserResponseDTO> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new ResourceNotFoundException('User not found.');
      return this.mapToDTO(user);
    } catch (error) {
      if (error instanceof ResourceNotFoundException) throw error;
      logger.error(`Error fetching user ${userId}: ${error}`);
      throw new InternalServerException('Failed to fetch user profile.');
    }
  }

  async updateMe(userId: string, data: UpdateUserDTO): Promise<UserResponseDTO> {
    try {
      const updated = await this.userRepository.update(userId, {
        name: data.name,
        email: data.email,
        avatarUrl: data.avatar_url,
        phone: data.phone,
      });
      return this.mapToDTO(updated);
    } catch (error) {
      logger.error(`Error updating user ${userId}: ${error}`);
      throw new InternalServerException('Failed to update user profile.');
    }
  }

  async searchByPhone(phone: string): Promise<UserResponseDTO> {
    try {
      const user = await this.userRepository.findByPhone(phone);
      if (!user) throw new ResourceNotFoundException('No user found with that phone number.');
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
    createdAt: Date;
  }): UserResponseDTO {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      avatar_url: user.avatarUrl,
      created_at: user.createdAt,
    };
  }
}

export default UserService;
