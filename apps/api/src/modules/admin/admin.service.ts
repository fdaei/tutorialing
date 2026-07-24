import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AdminRepository } from './admin.repository';

@Injectable()
export class AdminService {
  constructor(private db: PrismaService, private repo: AdminRepository) {}

  async dashboard() {
    const [users, teachers, pendingTeachers, attempts, pendingReviews, bookings, payments, payouts, tickets, revenue, credits, debits, recentActivity] = await this.db.$transaction([
      this.db.user.count({ where: { status: 'ACTIVE' } }),
      this.db.teacher.count({ where: { status: 'APPROVED' } }),
      this.db.teacher.count({ where: { status: { in: ['SUBMITTED','DOCUMENT_REVIEW','INTERVIEW','DEMO_REVIEW'] } } }),
      this.db.testAttempt.count(),
      this.db.testAttempt.count({ where: { status: 'UNDER_REVIEW' } }),
      this.db.booking.count(),
      this.db.payment.count(),
      this.db.payoutBatch.count(),
      this.db.ticket.count({ where: { status: { in: ['OPEN', 'WAITING_SUPPORT'] } } }),
      this.db.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
      this.db.walletEntry.aggregate({ where: { direction: 'CREDIT' }, _sum: { amount: true } }),
      this.db.walletEntry.aggregate({ where: { direction: 'DEBIT' }, _sum: { amount: true } }),
      this.db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);
    return { users, activeTeachers: teachers, pendingTeachers, testAttempts: attempts, pendingReviews, bookings, payments, payouts, openTickets: tickets, revenue: revenue._sum.amount ?? 0, walletLiability: (credits._sum.amount ?? 0) - (debits._sum.amount ?? 0), recentActivity };
  }

  async users(page = 1, search = '', status = '') {
    const take=30,where:Prisma.UserWhereInput={...(search&&{OR:[{name:{contains:search,mode:'insensitive'}},{phone:{contains:search}},{email:{contains:search,mode:'insensitive'}}]}),...(['ACTIVE','SUSPENDED','DELETED'].includes(status)&&{status:status as UserStatus})};
    const [data,total]=await this.repo.getUsers(where, (Math.max(1,page)-1)*take, take);
    return{data,total,page:Math.max(1,page),totalPages:Math.ceil(total/take)};
  }

  async userDetail(userId:string) {
    const user=await this.db.user.findUnique({where:{id:userId},include:{
      roles:true,
      teacher:{select:{slug:true,nameFa:true,nameEn:true,status:true,rating:true,reviewsCount:true}},
      bookings:{take:5,orderBy:{createdAt:'desc'},select:{startsAt:true,endsAt:true,status:true,type:true,price:true,teacher:{select:{nameFa:true,nameEn:true}}}},
      attempts:{take:5,orderBy:{createdAt:'desc'},select:{status:true,overallBand:true,startedAt:true,submittedAt:true,test:{select:{titleFa:true,titleEn:true}}}},
      payments:{take:5,orderBy:{createdAt:'desc'},select:{purpose:true,amount:true,status:true,createdAt:true}},
      tickets:{take:5,orderBy:{updatedAt:'desc'},select:{subject:true,status:true,priority:true,updatedAt:true}},
      learningPlans:{take:5,orderBy:{updatedAt:'desc'},select:{title:true,targetBand:true,status:true,examDate:true,teacher:{select:{nameFa:true,nameEn:true}}}},
      _count:{select:{bookings:true,attempts:true,payments:true,tickets:true,learningPlans:true,enrollments:true}}
    }});
    if(!user)throw new NotFoundException('User not found');
    return user;
  }

  async createUser(actorId:string,d:{phone:string;name:string;email?:string;locale?:string;roles?:Role[]}){
    const roles:Role[]=d.roles?.length?d.roles:['STUDENT'];
    const user=await this.db.user.create({data:{phone:d.phone,name:d.name.trim(),email:d.email?.trim()||undefined,locale:d.locale??'fa',profileComplete:true,roles:{create:roles.map(role=>({role}))}},include:{roles:true}});
    if(roles.includes('ADMIN'))await this.grantAdminPermissions(user.id);
    await this.db.auditLog.create({data:{actorId,action:'user.created',entity:'User',entityId:user.id,after:{phone:user.phone,roles}}});return user;
  }

  async updateUserStatus(actorId:string,userId:string,status:UserStatus){
    const before=await this.db.user.findUnique({where:{id:userId}});if(!before)throw new NotFoundException('User not found');
    if(before.id===actorId&&status!=='ACTIVE')throw new BadRequestException('You cannot disable your own account');
    const user=await this.db.user.update({where:{id:userId},data:{status}});await this.db.auditLog.create({data:{actorId,action:'user.status.changed',entity:'User',entityId:userId,before:{status:before.status},after:{status}}});return user;
  }

  async setUserRoles(actorId:string,userId:string,roles:Role[]){
    const normalized=[...new Set(roles)];
    if(!normalized.length)throw new BadRequestException('At least one role is required');
    const user=await this.db.user.findUnique({where:{id:userId},include:{roles:true}});if(!user)throw new NotFoundException('User not found');
    const before=user.roles.map(item=>item.role);
    if(userId===actorId&&before.includes('ADMIN')&&!normalized.includes('ADMIN'))throw new BadRequestException('You cannot remove your own admin role');
    if(before.includes('ADMIN')&&!normalized.includes('ADMIN')){const admins=await this.db.userRole.count({where:{role:'ADMIN'}});if(admins<=1)throw new BadRequestException('Cannot remove the last admin role')}
    await this.db.$transaction(async tx=>{
      await tx.userRole.deleteMany({where:{userId,role:{notIn:normalized}}});
      for(const role of normalized)await tx.userRole.upsert({where:{userId_role:{userId,role}},create:{userId,role},update:{}});
      await tx.auditLog.create({data:{actorId,action:'user.roles.changed',entity:'User',entityId:userId,before:{roles:before},after:{roles:normalized}}});
    });
    if(normalized.includes('ADMIN'))await this.grantAdminPermissions(userId);
    return this.db.user.findUniqueOrThrow({where:{id:userId},include:{roles:true}});
  }

  applications() {
    return this.repo.getTeacherApplications();
  }

  bookings() {
    return this.repo.getBookings();
  }

  tickets() {
    return this.repo.getTickets();
  }

  notificationDeliveries() {
    return this.repo.getNotificationDeliveries();
  }

  roles() {
    return this.repo.getRoles();
  }

  permissions() {
    return this.db.permission.findMany({ orderBy: { key: 'asc' } });
  }

  async assignRole(actorId: string, userId: string, role: Role) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const out = await this.db.userRole.upsert({ where: { userId_role: { userId, role } }, create: { userId, role }, update: {} });
    if(role==='ADMIN')await this.grantAdminPermissions(userId);
    await this.db.auditLog.create({ data: { actorId, action: 'role.assigned', entity: 'UserRole', entityId: userId, after: { role } } });
    return out;
  }

  private async grantAdminPermissions(userId:string){
    const permissions=await this.db.permission.findMany({select:{id:true}});
    if(permissions.length)await this.db.rolePermission.createMany({data:permissions.map(permission=>({userId,role:'ADMIN' as const,permissionId:permission.id})),skipDuplicates:true});
  }

  async revokeRole(actorId: string, userId: string, role: Role) {
    if (role === 'ADMIN') {
      const admins = await this.db.userRole.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) throw new BadRequestException('Cannot revoke the last admin role');
    }
    await this.db.userRole.delete({ where: { userId_role: { userId, role } } });
    await this.db.auditLog.create({ data: { actorId, action: 'role.revoked', entity: 'UserRole', entityId: userId, before: { role } } });
    return { ok: true };
  }

  async grantPermission(actorId: string, userId: string, role: Role, permissionKey: string) {
    const permission = await this.db.permission.findUnique({ where: { key: permissionKey } });
    if (!permission) throw new NotFoundException('Permission not found');
    await this.db.userRole.upsert({ where: { userId_role: { userId, role } }, create: { userId, role }, update: {} });
    const out = await this.db.rolePermission.upsert({ where: { userId_role_permissionId: { userId, role, permissionId: permission.id } }, create: { userId, role, permissionId: permission.id }, update: {} });
    await this.db.auditLog.create({ data: { actorId, action: 'permission.granted', entity: 'RolePermission', entityId: userId, after: { role, permission: permissionKey } } });
    return out;
  }

  reports() {
    return this.db.$transaction(async (tx) => {
      const [bookingsByStatus, paymentsByStatus, earningsByStatus, payoutsByStatus] = await Promise.all([
        tx.booking.groupBy({ by: ['status'], _count: { _all: true }, _sum: { price: true }, orderBy: { status: 'asc' } }),
        tx.payment.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amount: true }, orderBy: { status: 'asc' } }),
        tx.earning.groupBy({ by: ['status'], _count: { _all: true }, _sum: { netAmount: true }, orderBy: { status: 'asc' } }),
        tx.payoutBatch.groupBy({ by: ['status'], _count: { _all: true }, _sum: { totalAmount: true }, orderBy: { status: 'asc' } }),
      ]);
      return { bookingsByStatus, paymentsByStatus, earningsByStatus, payoutsByStatus };
    });
  }

  audit() {
    return this.db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  payments() {
    return this.repo.getPayments();
  }

  settings() {
    return this.db.setting.findMany();
  }

  setSetting(key: string, value: unknown, isPublic: boolean) {
    return this.db.setting.upsert({ where: { key }, create: { key, value: value as object, public: isPublic }, update: { value: value as object, public: isPublic } });
  }

  cms() {
    return this.db.cmsPage.findMany({ orderBy: { slug: 'asc' } });
  }

  upsertCms(slug: string, d: Record<string, unknown>) {
    const titleFa = String(d.titleFa ?? slug);
    const titleEn = String(d.titleEn ?? slug);
    const contentFa = (d.contentFa ?? {}) as Prisma.InputJsonValue;
    const contentEn = (d.contentEn ?? {}) as Prisma.InputJsonValue;
    const seo = (d.seo ?? {}) as Prisma.InputJsonValue;
    const published = d.published === true;
    return this.db.cmsPage.upsert({
      where: { slug },
      create: { slug, titleFa, titleEn, contentFa, contentEn, seo, published },
      update: { titleFa, titleEn, contentFa, contentEn, seo, published },
    });
  }
}
