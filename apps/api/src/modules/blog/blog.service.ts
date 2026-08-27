import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
@Injectable() export class BlogService {
 constructor(private db: PrismaService) {}
 list(q:any){const page=Math.max(1,Number(q.page)||1), size=Math.min(50,Number(q.pageSize)||12); const where:any={status:'PUBLISHED'}; if(q.category) where.category={slug:q.category}; if(q.search) where.OR=[{titleFa:{contains:q.search,mode:'insensitive'}},{titleEn:{contains:q.search,mode:'insensitive'}},{excerptFa:{contains:q.search,mode:'insensitive'}}]; return this.db.blogPost.findMany({where,skip:(page-1)*size,take:size,orderBy:{publishedAt:'desc'},include:{category:true,tags:true,author:{select:{id:true,name:true,avatarKey:true}},_count:{select:{views:true}}}}).then(async items=>({items,page,pageSize:size}));}
 detail(slug:string){return this.db.blogPost.findFirst({where:{slug,status:'PUBLISHED'},include:{category:true,tags:true,author:{select:{id:true,name:true,avatarKey:true}},images:true,ratings:true,_count:{select:{views:true,comments:true}}}})}
 create(userId:string,d:any){return this.db.blogPost.create({data:{...d,authorId:userId,tags:d.tagIds?{connect:d.tagIds.map((id:string)=>({id}))}:undefined}})}
 update(id:string,d:any){return this.db.blogPost.update({where:{id},data:d})}
 publish(id:string){return this.db.blogPost.update({where:{id},data:{status:'PUBLISHED',publishedAt:new Date()}})}
 comments(postId:string){return this.db.blogComment.findMany({where:{postId,status:'APPROVED'},orderBy:{createdAt:'desc'},include:{user:{select:{name:true}}}})}
 async react(postId:string,userId:string,type:string){return this.db.blogReaction.upsert({where:{postId_userId:{postId,userId}},create:{postId,userId,type:type as any},update:{type:type as any}})}
 async rate(postId:string,userId:string,value:number){if(value<1||value>5) throw new Error('rating'); return this.db.blogRating.upsert({where:{postId_userId:{postId,userId}},create:{postId,userId,value},update:{value}})}
 view(postId:string,key:string){return this.db.blogView.upsert({where:{postId_visitorKey:{postId,visitorKey:key}},create:{postId,visitorKey:key},update:{}})}
}
