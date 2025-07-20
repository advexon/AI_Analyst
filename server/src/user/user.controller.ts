import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';
import { UserRole } from './schemas/user.schema';

export interface UpdateUserRoleDto {
  role: UserRole;
}

export interface ChangePasswordDto {
  newPassword: string;
}

@Controller('admin/users')
// @UseGuards(JwtAuthGuard) // Disabled for Ministry use
export class UserController {
  constructor(private userService: UserService) {}

  // Helper method to get user ID - defaults to admin user for local secure environment
  private getUserId(req: any): string {
    return req.user?._id?.toString() || '507f1f77bcf86cd799439011'; // Default ObjectId for Ministry Admin
  }

  @Get()
  async getAllUsers(@Request() req) {
    try {
      const adminId = this.getUserId(req);
      const users = await this.userService.getAllUsers(adminId);
      return {
        users,
        total: users.length,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve users',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  @Get('stats')
  async getUserStats(@Request() req) {
    try {
      const adminId = this.getUserId(req);
      return await this.userService.getUserStats(adminId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve user statistics',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  @Put(':userId/role')
  async updateUserRole(
    @Param('userId') userId: string,
    @Body() updateRoleDto: UpdateUserRoleDto,
    @Request() req,
  ) {
    try {
      const adminId = this.getUserId(req);
      const updatedUser = await this.userService.updateUserRole(
        adminId,
        userId,
        updateRoleDto.role,
      );
      return {
        message: 'User role updated successfully',
        user: updatedUser,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update user role',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':userId/password')
  async changeUserPassword(
    @Param('userId') userId: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @Request() req,
  ) {
    try {
      const adminId = this.getUserId(req);
      await this.userService.changeUserPassword(
        adminId,
        userId,
        changePasswordDto.newPassword,
      );
      return {
        message: 'Password changed successfully',
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to change password',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':userId/toggle-status')
  async toggleUserStatus(@Param('userId') userId: string, @Request() req) {
    try {
      const adminId = this.getUserId(req);
      const updatedUser = await this.userService.toggleUserStatus(adminId, userId);
      return {
        message: `User ${updatedUser.isActive ? 'activated' : 'deactivated'} successfully`,
        user: updatedUser,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to toggle user status',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }
} 