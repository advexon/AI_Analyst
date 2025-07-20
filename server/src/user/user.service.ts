import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email,
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

    // Create user
    const user = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
    });

    return user.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email, isActive: true });
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id);
  }

  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // Admin user management methods
  async getAllUsers(requestingUserId: string): Promise<UserDocument[]> {
    const requestingUser = await this.findById(requestingUserId);
    
    if (!requestingUser || requestingUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can view all users');
    }

    return this.userModel.find().sort({ createdAt: -1 });
  }

  async updateUserRole(adminId: string, userId: string, newRole: UserRole): Promise<UserDocument> {
    const admin = await this.findById(adminId);
    
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can update user roles');
    }

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { role: newRole },
      { new: true }
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async changeUserPassword(adminId: string, userId: string, newPassword: string): Promise<void> {
    const admin = await this.findById(adminId);
    
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can change user passwords');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  async toggleUserStatus(adminId: string, userId: string): Promise<UserDocument> {
    const admin = await this.findById(adminId);
    
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can toggle user status');
    }

    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { isActive: !user.isActive },
      { new: true }
    );

    return updatedUser!;
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(
      userId,
      { lastLoginAt: new Date() }
    );
  }

  async getUserStats(adminId: string): Promise<any> {
    const admin = await this.findById(adminId);
    
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can view user statistics');
    }

    const totalUsers = await this.userModel.countDocuments();
    const activeUsers = await this.userModel.countDocuments({ isActive: true });
    const adminUsers = await this.userModel.countDocuments({ role: UserRole.ADMIN });
    const analystUsers = await this.userModel.countDocuments({ role: UserRole.ANALYST });
    const viewerUsers = await this.userModel.countDocuments({ role: UserRole.VIEWER });

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      adminUsers,
      analystUsers,
      viewerUsers,
    };
  }
} 