import { PrismaClient, UserRole, SituacaoMatricula } from '@prisma/client';
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

  const demoCount = await prisma.student.count({ where: { schoolId: school.id } });
  if (demoCount === 0) {
    const configs = await prisma.gradeConfig.findMany({ where: { schoolId: school.id, series: '1º Ano' } });
    const alunos = [
      { nome: 'Maria Eduarda Silva', cpf: '111.222.333-44' },
      { nome: 'João Pedro Santos', cpf: '111.222.333-55' },
      { nome: 'Ana Clara Oliveira', cpf: '111.222.333-66' },
      { nome: 'Lucas Ferreira Costa', cpf: '111.222.333-77' },
      { nome: 'Beatriz Almeida Souza', cpf: '111.222.333-88' },
      { nome: 'Gabriel Martins Lima', cpf: '111.222.333-99' },
    ];
    let idx = 0;
    for (const { nome, cpf } of alunos) {
      const birthDate = new Date(2015, idx % 12, 10 + idx);
      idx++;
      const student = await prisma.student.create({
        data: {
          schoolId: school.id,
          name: nome,
          birthDate,
          cpf,
          address: 'Rua do Seed, 1 — Centro',
          neighborhood: 'Centro',
          contacts: {
            create: [{ name: `Responsável (${nome.split(' ')[0]})`, phone: '19999990001', isPrimary: true }],
          },
        },
      });
      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          schoolId: school.id,
          year: 2024,
          series: '1º Ano',
          situation: SituacaoMatricula.CURSANDO,
        },
      });
      for (const config of configs) {
        for (let bim = 1; bim <= 4; bim++) {
          await prisma.grade.create({
            data: {
              enrollmentId: enrollment.id,
              gradeConfigId: config.id,
              bimester: bim,
              score: 7 + (bim + idx) * 0.15,
              frequency: 88 + bim,
            },
          });
        }
      }
    }
    console.log(`Seed: ${alunos.length} alunos de demonstração com matrícula 2024 e notas (1º Ano).`);
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
