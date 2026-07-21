import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { badRequest } from '../../common/errors';

type SearchEntity = 'users'|'teachers'|'tests'|'passages'|'bookings'|'payments'|'roles'|'languages'|'support-agents';

@Injectable()
export class SearchService {
  constructor(private db: PrismaService) {}

  async search(entity: SearchEntity, query: string, page = 1, pageSize = 20) {
    const q = query.trim();
    const take = Math.min(50, Math.max(1, pageSize));
    const skip = (Math.max(1, page) - 1) * take;
    switch (entity) {
      case 'users': return this.users(q, skip, take, page);
      case 'teachers': return this.teachers(q, skip, take, page);
      case 'tests': return this.tests(q, skip, take, page);
      case 'passages': return this.passages(q, skip, take, page);
      case 'bookings': return this.bookings(q, skip, take, page);
      case 'payments': return this.payments(q, skip, take, page);
      case 'languages': return this.languages(q, skip, take, page);
      case 'support-agents': return this.supportAgents(q, skip, take, page);
      case 'roles': return this.roles(q, page, take);
      default: throw badRequest('SEARCH_ENTITY_INVALID', 'نوع جستجو معتبر نیست.', 'Search entity is invalid.');
    }
  }

  private result(items: unknown[], total: number, page: number, pageSize: number) { return { items, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize), hasMore: page * pageSize < total } }; }

  private async users(q:string,skip:number,take:number,page:number) {
    const where: Prisma.UserWhereInput = q ? { OR: [{ name: { contains:q,mode:'insensitive' } },{ phone:{ contains:q } },{ email:{ contains:q,mode:'insensitive' } }] } : {};
    const [rows,total]=await this.db.$transaction([this.db.user.findMany({where,select:{id:true,name:true,phone:true,email:true,roles:{select:{role:true}}},orderBy:{updatedAt:'desc'},skip,take}),this.db.user.count({where})]);
    return this.result(rows.map(r=>({id:r.id,label:r.name||r.phone,description:[r.phone,r.email,r.roles.map(x=>x.role).join(', ')].filter(Boolean).join(' • ')})),total,page,take);
  }
  private async teachers(q:string,skip:number,take:number,page:number) {
    const where: Prisma.TeacherWhereInput=q?{OR:[{nameFa:{contains:q,mode:'insensitive'}},{nameEn:{contains:q,mode:'insensitive'}},{user:{OR:[{phone:{contains:q}},{email:{contains:q,mode:'insensitive'}}]}}]}:{};
    const [rows,total]=await this.db.$transaction([this.db.teacher.findMany({where,select:{id:true,nameFa:true,nameEn:true,status:true,user:{select:{phone:true,email:true}},languageLinks:{where:{active:true},include:{language:true}}},orderBy:{updatedAt:'desc'},skip,take}),this.db.teacher.count({where})]);
    return this.result(rows.map(r=>({id:r.id,label:`${r.nameFa} / ${r.nameEn}`,description:[r.user.phone,r.user.email,r.status,r.languageLinks.map(x=>x.language.nativeName).join(', ')].filter(Boolean).join(' • ')})),total,page,take);
  }
  private async tests(q:string,skip:number,take:number,page:number) {
    const where: Prisma.TestDefinitionWhereInput=q?{OR:[{titleFa:{contains:q,mode:'insensitive'}},{titleEn:{contains:q,mode:'insensitive'}},{slug:{contains:q,mode:'insensitive'}}]}:{};
    const [rows,total]=await this.db.$transaction([this.db.testDefinition.findMany({where,select:{id:true,titleFa:true,titleEn:true,published:true,level:true,language:true},orderBy:{updatedAt:'desc'},skip,take}),this.db.testDefinition.count({where})]);
    return this.result(rows.map(r=>({id:r.id,label:`${r.titleFa} / ${r.titleEn}`,description:[r.language.nativeName,r.level,r.published?'Published':'Draft'].filter(Boolean).join(' • ')})),total,page,take);
  }
  private async passages(q:string,skip:number,take:number,page:number) {
    const where: Prisma.PassageWhereInput=q?{OR:[{title:{contains:q,mode:'insensitive'}},{section:{title:{contains:q,mode:'insensitive'}}}]}:{};
    const [rows,total]=await this.db.$transaction([this.db.passage.findMany({where,select:{id:true,title:true,section:{select:{title:true,test:{select:{titleFa:true,titleEn:true,language:true}}}}},orderBy:{order:'asc'},skip,take}),this.db.passage.count({where})]);
    return this.result(rows.map(r=>({id:r.id,label:r.title,description:`${r.section.test.titleFa} • ${r.section.title} • ${r.section.test.language.nativeName}`})),total,page,take);
  }
  private async bookings(q:string,skip:number,take:number,page:number) {
    const where: Prisma.BookingWhereInput=q?{OR:[{student:{OR:[{name:{contains:q,mode:'insensitive'}},{phone:{contains:q}}]}},{teacher:{OR:[{nameFa:{contains:q,mode:'insensitive'}},{nameEn:{contains:q,mode:'insensitive'}}]}}]}:{};
    const [rows,total]=await this.db.$transaction([this.db.booking.findMany({where,select:{id:true,startsAt:true,status:true,type:true,student:{select:{name:true,phone:true}},teacher:{select:{nameFa:true,nameEn:true}}},orderBy:{startsAt:'desc'},skip,take}),this.db.booking.count({where})]);
    return this.result(rows.map(r=>({id:r.id,label:`${r.student.name||r.student.phone} — ${r.teacher.nameFa}`,description:`${r.startsAt.toISOString()} • ${r.type} • ${r.status}`})),total,page,take);
  }
  private async payments(q:string,skip:number,take:number,page:number) {
    const where: Prisma.PaymentWhereInput=q?{OR:[{user:{OR:[{name:{contains:q,mode:'insensitive'}},{phone:{contains:q}},{email:{contains:q,mode:'insensitive'}}]}},{gatewayReference:{contains:q,mode:'insensitive'}},{authority:{contains:q,mode:'insensitive'}}]}:{};
    const [rows,total]=await this.db.$transaction([this.db.payment.findMany({where,select:{id:true,amount:true,status:true,createdAt:true,purpose:true,user:{select:{name:true,phone:true}}},orderBy:{createdAt:'desc'},skip,take}),this.db.payment.count({where})]);
    return this.result(rows.map(r=>({id:r.id,label:`${r.user.name||r.user.phone} — ${r.amount.toLocaleString('en-US')}`,description:`${r.purpose} • ${r.status} • ${r.createdAt.toISOString()}`})),total,page,take);
  }
  private async languages(q:string,skip:number,take:number,page:number) {
    const where: Prisma.LanguageWhereInput={active:true,...(q?{OR:[{nameFa:{contains:q,mode:'insensitive'}},{nameEn:{contains:q,mode:'insensitive'}},{nativeName:{contains:q,mode:'insensitive'}},{code:{contains:q,mode:'insensitive'}}]}:{})};
    const [rows,total]=await this.db.$transaction([this.db.language.findMany({where,orderBy:[{order:'asc'},{nameEn:'asc'}],skip,take}),this.db.language.count({where})]);
    return this.result(rows.map(r=>({id:r.id,label:`${r.flag??''} ${r.nativeName}`.trim(),description:`${r.nameFa} / ${r.nameEn} • ${r.proficiencySystem}`})),total,page,take);
  }
  private async supportAgents(q:string,skip:number,take:number,page:number) {
    const roles:Role[]=['ADMIN','STAFF','SUPPORT'];
    const where: Prisma.UserWhereInput={status:'ACTIVE',roles:{some:{role:{in:roles}}},...(q?{OR:[{name:{contains:q,mode:'insensitive'}},{phone:{contains:q}},{email:{contains:q,mode:'insensitive'}}]}:{})};
    const [rows,total]=await this.db.$transaction([this.db.user.findMany({where,select:{id:true,name:true,phone:true,email:true,roles:{select:{role:true}}},orderBy:{name:'asc'},skip,take}),this.db.user.count({where})]);
    return this.result(rows.map(r=>({id:r.id,label:r.name||r.phone,description:[r.phone,r.email,r.roles.map(x=>x.role).join(', ')].filter(Boolean).join(' • ')})),total,page,take);
  }
  private roles(q:string,page:number,pageSize:number) {
    const rows=Object.values(Role).filter(role=>!q||role.toLowerCase().includes(q.toLowerCase())).map(role=>({id:role,label:role,description:`System role: ${role}`}));
    const start=(Math.max(1,page)-1)*pageSize;return this.result(rows.slice(start,start+pageSize),rows.length,page,pageSize);
  }
}
