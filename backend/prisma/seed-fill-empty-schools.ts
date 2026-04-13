/**
 * Preenche escolas com alunos, matrículas (2024) e notas de demonstração.
 *
 *   npm run prisma:seed:fill-empty
 *   npm run seed:alunos
 *
 * Uma escola de cada vez (recomendado):
 *   SEED_FILL_SCHOOL_ID=clxx...   ou   SEED_FILL_SCHOOL_CODE=35600001
 *   SEED_FILL_PER_SCHOOL=30     (opcional)
 *
 * Todas as escolas sem alunos (comportamento antigo, sem ID/código):
 *   SEED_FILL_MAX_SCHOOLS=150
 *
 * SKIP_SEED_FILL=1 ignora o script.
 */
import { PrismaClient, SituacaoMatricula } from '@prisma/client';

const prisma = new PrismaClient();

const SERIES_DEFAULT = '1º Ano';
const DISCIPLINAS = ['Língua Portuguesa', 'Matemática', 'Ciências', 'História', 'Geografia', 'Artes', 'Educação Física'];
const NOMES = [
  'Ana', 'Bruno', 'Carlos', 'Daniela', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena', 'Igor', 'Julia',
  'Lucas', 'Mariana', 'Nathan', 'Olivia', 'Pedro', 'Rafael', 'Sophia', 'Thiago', 'Valentina', 'Vitor',
];
const SOBRENOMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes',
];
const BAIRROS = ['Centro', 'Jardim das Flores', 'Vila Nova', 'São José', 'Bela Vista', 'Parque Industrial'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function between(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function cpfFromCounter(n: number): string {
  const s = String(10000000000 + (n % 100000000000)).padStart(11, '0');
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}

async function ensureGradeConfigs(schoolId: string): Promise<void> {
  const exist = await prisma.gradeConfig.count({ where: { schoolId, series: SERIES_DEFAULT } });
  if (exist > 0) return;
  await prisma.gradeConfig.createMany({
    data: DISCIPLINAS.map((subject) => ({
      schoolId,
      series: SERIES_DEFAULT,
      subject,
      workload: 80,
    })),
  });
}

type SchoolRow = { id: string; name: string; code: string | null };

async function fillStudentsForSchool(school: SchoolRow, perSchool: number, seq: { n: number }): Promise<number> {
  await ensureGradeConfigs(school.id);
  const configs = await prisma.gradeConfig.findMany({
    where: { schoolId: school.id, series: SERIES_DEFAULT },
  });
  if (configs.length === 0) {
    console.warn(`  [${school.name}] sem GradeConfig após ensure — a saltar.`);
    return 0;
  }

  let created = 0;
  for (let a = 0; a < perSchool; a++) {
    const cpf = cpfFromCounter(seq.n++);
    const nome = `${pick(NOMES)} ${pick(SOBRENOMES)}`;
    const bairro = pick(BAIRROS);
    const birthYear = between(2014, 2018);
    const birthDate = new Date(birthYear, between(0, 11), between(1, 28));

    const student = await prisma.student.create({
      data: {
        schoolId: school.id,
        name: nome,
        birthDate,
        cpf,
        address: `Rua ${pick(SOBRENOMES)}, ${between(1, 999)} - ${bairro}`,
        neighborhood: bairro,
        contacts: {
          create: [
            {
              name: `Responsável de ${nome.split(' ')[0]}`,
              phone: `19${between(90000, 99999)}${between(1000, 9999)}`,
              isPrimary: true,
            },
          ],
        },
      },
    });

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        schoolId: school.id,
        year: 2024,
        series: SERIES_DEFAULT,
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
            score: between(50, 100) / 10,
            frequency: between(75, 100),
          },
        });
      }
    }
    created++;
  }
  console.log(`  ✅ ${school.name}: ${created} alunos com notas (2024, ${SERIES_DEFAULT}).`);
  return created;
}

async function main(): Promise<void> {
  if (process.env.SKIP_SEED_FILL === '1') {
    console.log('SKIP_SEED_FILL=1 — seed-fill-empty ignorado.');
    return;
  }

  const perSchool = Number.parseInt(process.env.SEED_FILL_PER_SCHOOL ?? '30', 10) || 30;
  const maxSchools = Number.parseInt(process.env.SEED_FILL_MAX_SCHOOLS ?? '150', 10) || 150;
  const schoolIdEnv = process.env.SEED_FILL_SCHOOL_ID?.trim();
  const schoolCodeEnv = process.env.SEED_FILL_SCHOOL_CODE?.trim();

  let schools: SchoolRow[];

  if (schoolIdEnv || schoolCodeEnv) {
    const school = await prisma.school.findFirst({
      where: schoolIdEnv ? { id: schoolIdEnv } : { code: schoolCodeEnv! },
      select: {
        id: true,
        name: true,
        code: true,
        _count: { select: { students: true } },
      },
    });
    if (!school) {
      console.error(
        schoolIdEnv
          ? `Escola não encontrada com id="${schoolIdEnv}".`
          : `Escola não encontrada com code="${schoolCodeEnv}".`,
      );
      process.exit(1);
    }
    if (school._count.students > 0) {
      console.error(
        `A escola "${school.name}" já tem ${school._count.students} aluno(s). ` +
          `Usa outra escola (outro id/código) ou só preenche escolas vazias.`,
      );
      process.exit(1);
    }
    schools = [{ id: school.id, name: school.name, code: school.code }];
    console.log(`Modo uma escola: ${school.name} (id=${school.id}${school.code ? `, código=${school.code}` : ''}).`);
  } else {
    schools = await prisma.school.findMany({
      where: { students: { none: {} } },
      take: maxSchools,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true },
    });

    if (schools.length === 0) {
      console.log('Nenhuma escola sem alunos. Nada a fazer.');
      console.log('Dica: define SEED_FILL_SCHOOL_ID ou SEED_FILL_SCHOOL_CODE para preencher uma escola concreta.');
      return;
    }

    console.log(`Encontradas ${schools.length} escolas sem alunos (máx. ${maxSchools}). ~${perSchool} alunos/escola.`);
  }

  const seq = { n: (await prisma.student.count()) + 500_000 };
  let totalStudents = 0;

  for (const school of schools) {
    const n = await fillStudentsForSchool(school, perSchool, seq);
    totalStudents += n;
  }

  console.log(`\nConcluído: ${totalStudents} alunos criados em ${schools.length} escola(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
