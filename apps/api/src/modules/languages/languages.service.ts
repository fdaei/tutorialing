import { Injectable } from '@nestjs/common';
import { LanguageDirection, Prisma, ProficiencySystem } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { badRequest, conflict, notFound } from '../../common';

export type LanguageInput = {
  code: string;
  nameFa: string;
  nameEn: string;
  nativeName: string;
  flag?: string;
  direction: LanguageDirection;
  active?: boolean;
  order?: number;
  proficiencySystem: ProficiencySystem;
};

@Injectable()
export class LanguagesService {
  constructor(private readonly db: PrismaService) {}

  publicList(includeInactive = false) {
    return this.db.language.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ order: 'asc' }, { nameEn: 'asc' }],
      select: {
        id: true,
        code: true,
        nameFa: true,
        nameEn: true,
        nativeName: true,
        flag: true,
        direction: true,
        active: true,
        order: true,
        proficiencySystem: true,
      },
    });
  }

  async adminList(page: number, limit: number, search = '', active?: boolean) {
    const where: Prisma.LanguageWhereInput = {
      ...(active !== undefined && { active }),
      ...(search && {
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { nameFa: { contains: search, mode: 'insensitive' } },
          { nameEn: { contains: search, mode: 'insensitive' } },
          { nativeName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await this.db.$transaction([
      this.db.language.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ order: 'asc' }, { nameEn: 'asc' }],
      }),
      this.db.language.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private normalize(input: LanguageInput) {
    const code = input.code.trim().toLowerCase();
    if (!/^[a-z]{2,8}(?:-[a-z0-9]{2,8})?$/.test(code)) {
      throw badRequest('LANGUAGE_CODE_INVALID');
    }
    const required = [input.nameFa, input.nameEn, input.nativeName];
    if (required.some((value) => !value?.trim())) {
      throw badRequest('LANGUAGE_NAME_REQUIRED');
    }
    return {
      code,
      nameFa: input.nameFa.trim(),
      nameEn: input.nameEn.trim(),
      nativeName: input.nativeName.trim(),
      flag: input.flag?.trim() || null,
      direction: input.direction,
      proficiencySystem: input.proficiencySystem,
      active: input.active ?? true,
      order: Math.max(0, Number(input.order ?? 0)),
    };
  }

  async create(actorId: string, input: LanguageInput) {
    const data = this.normalize(input);
    const exists = await this.db.language.findUnique({ where: { code: data.code } });
    if (exists) throw conflict('LANGUAGE_CODE_EXISTS');
    return this.db.$transaction(async (tx) => {
      const language = await tx.language.create({ data });
      await tx.auditLog.create({
        data: { actorId, action: 'language.created', entity: 'Language', entityId: language.id, after: data },
      });
      return language;
    });
  }

  async update(actorId: string, id: string, input: Partial<LanguageInput>) {
    const before = await this.db.language.findUnique({ where: { id } });
    if (!before) throw notFound('LANGUAGE_NOT_FOUND');
    const merged = this.normalize({
      code: input.code ?? before.code,
      nameFa: input.nameFa ?? before.nameFa,
      nameEn: input.nameEn ?? before.nameEn,
      nativeName: input.nativeName ?? before.nativeName,
      flag: input.flag ?? before.flag ?? undefined,
      direction: input.direction ?? before.direction,
      active: input.active ?? before.active,
      order: input.order ?? before.order,
      proficiencySystem: input.proficiencySystem ?? before.proficiencySystem,
    });
    const duplicate = await this.db.language.findFirst({ where: { code: merged.code, id: { not: id } } });
    if (duplicate) throw conflict('LANGUAGE_CODE_EXISTS');
    return this.db.$transaction(async (tx) => {
      const language = await tx.language.update({ where: { id }, data: merged });
      await tx.auditLog.create({
        data: { actorId, action: 'language.updated', entity: 'Language', entityId: id, before, after: merged },
      });
      return language;
    });
  }

  async remove(actorId: string, id: string) {
    const language = await this.db.language.findUnique({
      where: { id },
      include: { _count: { select: { teachers: true, tests: true, matchingSessions: true } } },
    });
    if (!language) throw notFound('LANGUAGE_NOT_FOUND');
    const usages = language._count.teachers + language._count.tests + language._count.matchingSessions;
    if (usages > 0) {
      throw conflict('LANGUAGE_IN_USE');
    }
    await this.db.$transaction(async (tx) => {
      await tx.language.delete({ where: { id } });
      await tx.auditLog.create({
        data: { actorId, action: 'language.deleted', entity: 'Language', entityId: id, before: language },
      });
    });
    return { ok: true };
  }
}
