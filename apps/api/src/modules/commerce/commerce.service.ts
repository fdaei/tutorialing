import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { config } from '../../config';
import { GatewayService } from './gateway.service';
import { QueueService } from '../queue/queue.service';
import { badRequest } from '../../common/errors';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CommerceService {
  constructor(private db: PrismaService, private gateway: GatewayService, private queue: QueueService) {}

  async walletBalance(userId: string, tx: PrismaService | Tx = this.db) {
    const [credits, debits] = await Promise.all([
      tx.walletEntry.aggregate({ where: { userId, direction: 'CREDIT' }, _sum: { amount: true } }),
      tx.walletEntry.aggregate({ where: { userId, direction: 'DEBIT' }, _sum: { amount: true } }),
    ]);
    return (credits._sum.amount ?? 0) - (debits._sum.amount ?? 0);
  }

  async createPayment(userId:string,d:{purpose:'booking'|'package';referenceId:string;walletAmount:number;discountCode?:string;idempotencyKey:string}) {
    const existing=await this.db.payment.findUnique({where:{idempotencyKey:d.idempotencyKey}});if(existing)return existing;
    const payment=await this.db.$transaction(async tx=>{
      let subtotal:number;let bookingId:string|undefined;
      if(d.purpose==='booking'){const booking=await tx.booking.findFirst({where:{id:d.referenceId,studentId:userId,status:'PENDING_PAYMENT'}});if(!booking)throw new NotFoundException();subtotal=booking.price;bookingId=booking.id}
      else{const pkg=await tx.package.findFirst({where:{id:d.referenceId,active:true,approvalStatus:'APPROVED'}});if(!pkg)throw new NotFoundException();subtotal=pkg.price}
      let discountAmount=0;
      if(d.discountCode){
        const discount=await tx.discount.findFirst({where:{code:d.discountCode,active:true,OR:[{startsAt:null},{startsAt:{lte:new Date()}}],AND:[{OR:[{endsAt:null},{endsAt:{gte:new Date()}}]}]}});
        if(!discount)throw new BadRequestException('Discount invalid');
        if(discount.maxUses!=null&&discount.usedCount>=discount.maxUses)throw new BadRequestException('Discount usage limit reached');
        discountAmount=Math.min(subtotal,discount.type==='percent'?Math.round(subtotal*discount.value/100):discount.value);
        await tx.discount.update({where:{id:discount.id},data:{usedCount:{increment:1}}});
      }
      const amount=subtotal-discountAmount,balance=await this.walletBalance(userId,tx);
      if(d.walletAmount<0||d.walletAmount>balance||d.walletAmount>amount)throw new BadRequestException('Wallet amount invalid');
      const gatewayAmount=amount-d.walletAmount;
      const payment=await tx.payment.create({data:{userId,purpose:d.purpose,referenceId:d.referenceId,bookingId,subtotal,discountAmount,walletAmount:d.walletAmount,gatewayAmount,amount,status:gatewayAmount===0?'PAID':'PENDING',idempotencyKey:d.idempotencyKey}});
      if(d.walletAmount)await this.ledger(tx,userId,'DEBIT',d.walletAmount,'wallet-payment','Payment',payment.id,`wallet:${payment.id}`);
      if(gatewayAmount===0)await this.fulfill(tx,payment.id);
      return payment;
    });
    if(payment.status==='PAID'&&payment.bookingId){const booking=await this.db.booking.findUnique({where:{id:payment.bookingId}});if(booking)await this.queue.scheduleBooking(booking.id,booking.startsAt)}
    return payment;
  }

  async gatewayRedirect(userId:string,paymentId:string){const payment=await this.db.payment.findFirstOrThrow({where:{id:paymentId,userId,status:'PENDING'}});const result=await this.gateway.request(payment.gatewayAmount,`LingoSpeak ${payment.purpose}`,`${config().API_URL??'http://localhost:4000'}/api/payments/callback`);await this.db.payment.update({where:{id:payment.id},data:{authority:result.authority}});return result}

  async callback(authority:string,status:string){
    const payment=await this.db.payment.findUnique({where:{authority}});if(!payment)throw new NotFoundException();if(payment.status==='PAID')return payment;
    if(status!=='OK')return this.failPayment(payment.id,{authority,status});
    const result=await this.gateway.verify(authority,payment.gatewayAmount);if(!result.ok)return this.failPayment(payment.id,{authority,status});
    const paid=await this.db.$transaction(async tx=>{const current=await tx.payment.findUniqueOrThrow({where:{id:payment.id}});if(current.status==='PAID')return current;const updated=await tx.payment.update({where:{id:payment.id},data:{status:'PAID',gatewayReference:result.reference,verifiedAt:new Date(),callbackPayload:{authority,status}}});await this.fulfill(tx,payment.id);return updated});
    if(payment.bookingId){const booking=await this.db.booking.findUnique({where:{id:payment.bookingId}});if(booking)await this.queue.scheduleBooking(booking.id,booking.startsAt)}
    return paid;
  }

  private async failPayment(paymentId:string,payload:object){return this.db.$transaction(async tx=>{const payment=await tx.payment.findUniqueOrThrow({where:{id:paymentId}});if(payment.status!=='PENDING')return payment;if(payment.walletAmount>0)await this.ledger(tx,payment.userId,'CREDIT',payment.walletAmount,'wallet payment rollback','Payment',payment.id,`wallet-rollback:${payment.id}`);return tx.payment.update({where:{id:payment.id},data:{status:'FAILED',callbackPayload:payload}})})}

  private async fulfill(tx:Tx,paymentId:string){
    const payment=await tx.payment.findUniqueOrThrow({where:{id:paymentId}});
    if(payment.purpose==='booking'){
      await tx.booking.update({where:{id:payment.referenceId},data:{status:'CONFIRMED'}});
      return;
    }
    const pkg=await tx.package.findUniqueOrThrow({where:{id:payment.referenceId}});
    const enrollment=await tx.enrollment.create({data:{studentId:payment.userId,packageId:pkg.id,creditsPurchased:pkg.credits,paymentId:payment.id}});
    await tx.creditEntry.create({data:{enrollmentId:enrollment.id,type:'PURCHASE',amount:pkg.credits,idempotencyKey:`purchase:${payment.id}`}});
  }

  private ledger(tx:Tx,userId:string,direction:'DEBIT'|'CREDIT',amount:number,description:string,referenceType:string,referenceId:string,idempotencyKey:string){return tx.walletEntry.create({data:{userId,transactionId:`tx_${referenceId}`,account:'user_wallet',direction,amount,description,referenceType,referenceId,idempotencyKey}})}

  async refund(actorId:string,paymentId:string,amount:number,reason:string,idempotencyKey:string){return this.db.$transaction(async tx=>{const existing=await tx.refund.findUnique({where:{idempotencyKey}});if(existing)return existing;const payment=await tx.payment.findUniqueOrThrow({where:{id:paymentId}});const aggregate=await tx.refund.aggregate({where:{paymentId,status:'completed'},_sum:{amount:true}});const already=aggregate._sum.amount??0;if(amount<=0||amount>payment.amount-already)throw new BadRequestException('Refund amount invalid');const refund=await tx.refund.create({data:{paymentId,amount,reason,status:'completed',idempotencyKey,approvedById:actorId}});await this.ledger(tx,payment.userId,'CREDIT',amount,'refund','Refund',refund.id,`refund-ledger:${refund.id}`);await tx.payment.update({where:{id:payment.id},data:{status:already+amount===payment.amount?'REFUNDED':'PARTIALLY_REFUNDED'}});return refund})}

  async createPackage(userId:string,data:{titleFa:string;titleEn:string;descriptionFa:string;descriptionEn:string;credits:number;lessonMinutes:number;price:number}){const teacher=await this.db.teacher.findUniqueOrThrow({where:{userId}});return this.db.package.create({data:{...data,teacherId:teacher.id}})}
  enrollments(userId:string){return this.db.enrollment.findMany({where:{studentId:userId},include:{package:{include:{teacher:true}},creditEntries:true},orderBy:{createdAt:'desc'}})}
  async generatePayout(weekStart:Date,weekEnd:Date){
    if (!Number.isFinite(weekStart.getTime()) || !Number.isFinite(weekEnd.getTime()) || weekEnd <= weekStart) {
      throw badRequest('PAYOUT_PERIOD_INVALID', 'بازه تسویه معتبر نیست.', 'The payout period is invalid.', {
        weekEnd: { fa: 'تاریخ پایان باید بعد از تاریخ شروع باشد و هر دو تاریخ را از تقویم انتخاب کنید.', en: 'The end date must be after the start date; choose both dates from the date picker.' },
      });
    }
    const earnings=await this.db.earning.findMany({
      where:{status:'ELIGIBLE',eligibleAt:{lte:weekEnd},createdAt:{gte:weekStart,lte:weekEnd},payoutItem:null},
      include:{booking:{select:{status:true,attendanceTeacher:true,attendanceStudent:true,startsAt:true,endsAt:true}}},
      orderBy:{createdAt:'asc'},
    });
    if(!earnings.length){
      const [completed,waiting,paid]=await this.db.$transaction([
        this.db.booking.count({where:{status:'COMPLETED',endsAt:{gte:weekStart,lte:weekEnd},attendanceTeacher:true}}),
        this.db.booking.count({where:{status:{in:['PENDING_PAYMENT','CONFIRMED']},startsAt:{gte:weekStart,lte:weekEnd}}}),
        this.db.earning.count({where:{createdAt:{gte:weekStart,lte:weekEnd},OR:[{status:'PAID'},{payoutItem:{isNot:null}}]}}),
      ]);
      throw badRequest(
        'NO_ELIGIBLE_TEACHER_EARNINGS',
        'در این بازه درآمد قابل تسویه‌ای پیدا نشد. فقط کلاس‌هایی که برگزار و تکمیل شده‌اند، حضور مدرس برای آن‌ها ثبت شده و قبلاً تسویه نشده‌اند وارد تسویه می‌شوند.',
        'No payable teacher earnings were found in this period. Only completed lessons with recorded teacher attendance that have not already been paid are eligible.',
        {
          period: {
            fa: `کلاس تکمیل‌شده: ${completed}، کلاس در انتظار تکمیل: ${waiting}، درآمد قبلاً تسویه‌شده: ${paid}. بازه یا وضعیت کلاس‌ها را بررسی کنید.`,
            en: `Completed lessons: ${completed}; waiting for completion: ${waiting}; already paid earnings: ${paid}. Review the period or lesson statuses.`,
          },
        },
      );
    }
    return this.db.$transaction(async tx=>tx.payoutBatch.create({
      data:{weekStart,weekEnd,totalAmount:earnings.reduce((sum,e)=>sum+e.netAmount,0),items:{create:earnings.map(e=>({earningId:e.id,teacherId:e.teacherId,amount:e.netAmount}))}},
      include:{items:true},
    }));
  }
  async approvePayout(id:string,actorId:string,reference?:string){return this.db.$transaction(async tx=>{const batch=await tx.payoutBatch.findUniqueOrThrow({where:{id},include:{items:true}});if(!['DRAFT','PENDING_APPROVAL'].includes(batch.status))throw new BadRequestException();await tx.earning.updateMany({where:{id:{in:batch.items.map(i=>i.earningId)}},data:{status:'PAID'}});return tx.payoutBatch.update({where:{id},data:{status:reference?'TRANSFERRED':'APPROVED',approvedById:actorId,approvedAt:new Date(),reference,transferredAt:reference?new Date():undefined}})})}
  async teacherFinance(userId:string){const teacher=await this.db.teacher.findUniqueOrThrow({where:{userId}});const earnings=await this.db.earning.findMany({where:{teacherId:teacher.id},orderBy:{createdAt:'desc'}});const totals=await this.db.earning.groupBy({by:['status'],where:{teacherId:teacher.id},_sum:{netAmount:true},orderBy:{status:'asc'}});const payouts=await this.db.payoutItem.findMany({where:{teacherId:teacher.id},include:{batch:true},orderBy:{batch:{createdAt:'desc'}}});return{earnings,totals,payouts}}
  approvePackage(id:string,actorId:string,status:'APPROVED'|'REJECTED'){return this.db.package.update({where:{id},data:{approvalStatus:status,approvedById:actorId}})}
  createDiscount(data:{code:string;type:string;value:number;maxUses?:number;startsAt?:string;endsAt?:string}){return this.db.discount.create({data:{...data,startsAt:data.startsAt?new Date(data.startsAt):undefined,endsAt:data.endsAt?new Date(data.endsAt):undefined}})}
}
