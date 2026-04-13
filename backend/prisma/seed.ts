import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const municipality = await prisma.municipality.upsert({
    where: { id: 'seed-municipio-1' },
    update: {},
    create: {
      id: 'seed-municipio-1',
      name: 'Município Exemplo',
      state: 'SP',
    },
  });

  const school = await prisma.school.upsert({
    where: { id: 'seed-school-1' },
    update: {},
    create: {
      id: 'seed-school-1',
      municipalityId: municipality.id,
      name: 'EMEF Exemplo',
      code: '35000000',
      address: 'Rua Exemplo, 100',
    },
  });

  const [adminUser, superUser] = await Promise.all([
    prisma.user.findUnique({ where: { email: 'admin@escola.municipio.gov.br' } }),
    prisma.user.findUnique({ where: { email: 'superadmin@municipio.gov.br' } }),
  ]);

  const baseUsersAlreadyExisted = Boolean(superUser && adminUser);

  if (!baseUsersAlreadyExisted) {
    const hash = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { email: 'superadmin@municipio.gov.br' },
      update: {},
      create: {
        email: 'superadmin@municipio.gov.br',
        passwordHash: hash,
        name: 'Super Admin',
        role: UserRole.SUPER_ADMIN,
        schoolId: null,
      },
    });

    await prisma.user.upsert({
      where: { email: 'admin@escola.municipio.gov.br' },
      update: {},
      create: {
        email: 'admin@escola.municipio.gov.br',
        passwordHash: hash,
        name: 'Admin Escolar',
        role: UserRole.ADMIN_ESCOLAR,
        schoolId: school.id,
      },
    });
  }

  // Disciplinas padrão para 1º Ano
  const subjects = ['Língua Portuguesa', 'Matemática', 'Ciências', 'História', 'Geografia', 'Artes', 'Educação Física'];
  const existing = await prisma.gradeConfig.count({ where: { schoolId: school.id, series: '1º Ano' } });
  if (existing === 0) {
    await prisma.gradeConfig.createMany({
      data: subjects.map((subject) => ({
        schoolId: school.id,
        series: '1º Ano',
        subject,
        workload: 80,
      })),
    });
  }

  if (baseUsersAlreadyExisted) {
    console.log(
      'Seed: município/escola/disciplinas verificados; contas base já existiam (superadmin + admin escolar).',
    );
  }
  console.log('Seed concluído. Login: superadmin@municipio.gov.br ou admin@escola.municipio.gov.br / senha: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
