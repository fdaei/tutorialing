import { Injectable } from '@nestjs/common';
import { LanguageDirection, Prisma, ProficiencySystem } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
<<<<<<< Updated upstream
import { badRequest, conflict, notFound } from '../../common';
||||||| Stash base
import { badRequest, conflict, notFound } from '../../common/errors';
=======
import { badRequest, conflict, notFound } from '../../common/errors';
import { assertDomain, requireValue } from '../../common/utils';
>>>>>>> Stashed changes

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
    assertDomain(/^[a-z]{2,8}(?:-[a-z0-9]{2,8})?$/.test(code), () => badRequest('LANGUAGE_CODE_INVALID'));
    const required = [input.nameFa, input.nameEn, input.nativeName];
    assertDomain(
      required.every((value) => value?.trim()),
      () => badRequest('LANGUAGE_NAME_REQUIRED'),
    );
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
    assertDomain(!exists, () => conflict('LANGUAGE_CODE_EXISTS'));
    return this.db.$transaction(async (tx) => {
      const language = await tx.language.create({ data });
      await tx.auditLog.create({
        data: { actorId, action: 'language.created', entity: 'Language', entityId: language.id, after: data },
      });
      return language;
    });
  }

  async update(actorId: string, id: string, input: Partial<LanguageInput>) {
    const before = requireValue(await this.db.language.findUnique({ where: { id } }), () =>
      notFound('LANGUAGE_NOT_FOUND'),
    );
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
    assertDomain(!duplicate, () => conflict('LANGUAGE_CODE_EXISTS'));
    return this.db.$transaction(async (tx) => {
      const language = await tx.language.update({ where: { id }, data: merged });
      await tx.auditLog.create({
        data: { actorId, action: 'language.updated', entity: 'Language', entityId: id, before, after: merged },
      });
      return language;
    });
  }

  async remove(actorId: string, id: string) {
    const language = requireValue(
      await this.db.language.findUnique({
        where: { id },
        include: { _count: { select: { teachers: true, tests: true, matchingSessions: true } } },
      }),
      () => notFound('LANGUAGE_NOT_FOUND'),
    );
    const usages = language._count.teachers + language._count.tests + language._count.matchingSessions;
    assertDomain(usages === 0, () => conflict('LANGUAGE_IN_USE'));
    await this.db.$transaction(async (tx) => {
      await tx.language.delete({ where: { id } });
      await tx.auditLog.create({
        data: { actorId, action: 'language.deleted', entity: 'Language', entityId: id, before: language },
      });
    });
    return { ok: true };
  }
}
