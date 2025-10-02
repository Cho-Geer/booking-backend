/**
 * 报表服务
 * 提供系统统计和报表相关的业务逻辑
 * @author Booking System
 * @since 2024
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取预约统计信息
   * @returns 预约统计
   */
  async getAppointmentStatistics() {
    const [
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      todayAppointments,
      thisWeekAppointments,
      thisMonthAppointments,
    ] = await Promise.all([
      this.prisma.appointment.count(),
      this.prisma.appointment.count({ where: { status: 'PENDING' } }),
      this.prisma.appointment.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.appointment.count({ where: { status: 'COMPLETED' } }),
      this.prisma.appointment.count({ where: { status: 'CANCELLED' } }),
      this.prisma.appointment.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.appointment.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      this.prisma.appointment.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    return {
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      todayAppointments,
      thisWeekAppointments,
      thisMonthAppointments,
    };
  }

  /**
   * 获取用户统计信息
   * @returns 用户统计
   */
  async getUserStatistics() {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      blockedUsers,
      customerUsers,
      adminUsers,
      todayNewUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { status: 'INACTIVE' } }),
      this.prisma.user.count({ where: { status: 'BLOCKED' } }),
      this.prisma.user.count({ where: { userType: 'CUSTOMER' } }),
      this.prisma.user.count({ where: { userType: 'ADMIN' } }),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      blockedUsers,
      customerUsers,
      adminUsers,
      todayNewUsers,
    };
  }
}